/**
 * ErrorGroupService — the Change Intelligence error loop.
 *
 * Error/fatal logs are fingerprinted at ingestion and rolled up into
 * ErrorGroups. New groups (and regressions of resolved groups) notify the
 * project owner without requiring an alert rule. Groups can be turned into
 * AI-drafted GitHub issues; closing the issue on GitHub resolves the group.
 */
import { Types } from "mongoose";
import {
  ErrorGroupModel,
  IErrorGroup,
} from "../models/errorGroup.model";
import { CommitModel } from "../models/commit.model";
import { LogModel, ILog } from "../models/log.model";
import { ProjectModel } from "../models/project.model";
import { UserModel } from "../models/user.model";
import { FingerprintService } from "./fingerprint.service";
import { NotificationService } from "./notification.service";
import { GithubAppService } from "./integrations/github-app.service";
import { createIssue as githubCreateIssue } from "./integrations/github-client";
import { AIService } from "../utils/ai/ai.service";
import { aiQueue } from "../utils/task-queue";
import { config } from "../config";
import logger from "../utils/logger";

/** Cap on the rolling session sample used to approximate users affected. */
const SESSION_SAMPLE_CAP = 500;
/** Minimum gap between notifications for the same group (regression flapping). */
const NOTIFY_COOLDOWN_MS = 30 * 60 * 1000;
/** Candidate window for suspect commits when release data is missing. */
const SUSPECT_WINDOW_DAYS = 7;
const SUSPECT_CANDIDATE_LIMIT = 20;

export class ErrorGroupService {
  // ------------------------------------------------------------------
  // Ingestion-side grouping
  // ------------------------------------------------------------------

  /**
   * Roll an error log into its group. Called fire-and-forget after the log
   * is persisted (never blocks ingestion). The log is expected to already
   * carry its fingerprint (set by LogService before save).
   */
  static async recordError(log: ILog): Promise<void> {
    try {
      const fingerprint =
        (log as any).fingerprint ||
        FingerprintService.compute({
          errorName: log.error?.name,
          message: log.error?.message || log.message,
          stack: log.error?.stack,
        });

      const title = FingerprintService.buildTitle({
        errorName: log.error?.name,
        message: log.error?.message || log.message,
        stack: log.error?.stack,
      });

      const occurredAt = log.createdAt || new Date();

      const update: Record<string, any> = {
        $setOnInsert: {
          projectId: log.projectId,
          fingerprint,
          title,
          errorName: log.error?.name,
          sampleMessage: log.error?.message || log.message,
          firstSeen: occurredAt,
          releaseFirstSeen: log.release,
          status: "unresolved",
          regressed: false,
        },
        $set: {
          lastSeen: occurredAt,
          sampleStack: log.error?.stack,
          sampleLogId: String(log._id),
          releaseLastSeen: log.release,
        },
        $inc: { count: 1 },
      };
      const addToSet: Record<string, string> = {};
      if (log.environment) addToSet.environments = log.environment;
      if (log.service) addToSet.services = log.service;
      if (Object.keys(addToSet).length > 0) update.$addToSet = addToSet;

      const group = await ErrorGroupModel.findOneAndUpdate(
        { projectId: log.projectId, fingerprint },
        update,
        { upsert: true, new: true }
      );

      const isNew = group.count === 1;

      // Approximate distinct sessions with a capped rolling sample
      if (log.sessionId && group.sessionSample.length < SESSION_SAMPLE_CAP) {
        const added = await ErrorGroupModel.updateOne(
          {
            _id: group._id,
            sessionSample: { $ne: log.sessionId },
          },
          {
            $push: { sessionSample: log.sessionId },
            $inc: { sessionCount: 1 },
          }
        );
        if (added.modifiedCount > 0) group.sessionCount += 1;
      }

      // Regression: a resolved group received a new event
      let regressed = false;
      if (!isNew && group.status === "resolved") {
        regressed = true;
        await ErrorGroupModel.updateOne(
          { _id: group._id },
          {
            $set: {
              status: "unresolved",
              regressed: true,
              regressedAt: occurredAt,
            },
          }
        );
      }

      if (isNew || regressed) {
        await this.notifyOwner(group, isNew ? "new" : "regressed");
      }
    } catch (error) {
      logger.error("ErrorGroupService: recordError failed", {
        projectId: log.projectId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Zero-config owner notification: in-app (+WebSocket) always, email when
   * the platform has email configured. Deduped per group via lastNotifiedAt.
   */
  private static async notifyOwner(
    group: IErrorGroup,
    kind: "new" | "regressed"
  ): Promise<void> {
    // Cooldown guard (new groups fire once by construction, regressions can flap)
    if (
      kind === "regressed" &&
      group.lastNotifiedAt &&
      Date.now() - group.lastNotifiedAt.getTime() < NOTIFY_COOLDOWN_MS
    ) {
      return;
    }

    const project = await ProjectModel.findById(group.projectId)
      .select("name ownerId integrationSettings")
      .lean();
    if (!project) return;

    // Per-project opt-out
    if ((project as any).integrationSettings?.errorNotifications === false) {
      return;
    }

    const ownerId = (project as any).ownerId?.toString();
    if (!ownerId) return;

    const projectName = (project as any).name || "your project";
    const environment = group.environments[group.environments.length - 1];
    const groupUrl = `${config.frontend.url}/projects/${group.projectId}/issues?group=${group._id}`;

    const headline =
      kind === "new"
        ? `New error in ${projectName}`
        : `Error is back in ${projectName}`;
    const message = `${headline}: ${group.title}${environment ? ` (${environment})` : ""}`;

    await ErrorGroupModel.updateOne(
      { _id: group._id },
      { $set: { lastNotifiedAt: new Date() } }
    );

    await NotificationService.sendInApp(ownerId, "error", message, {
      kind: kind === "new" ? "error_group_new" : "error_group_regressed",
      projectId: group.projectId,
      errorGroupId: String(group._id),
      url: groupUrl,
    });

    // Email (best effort)
    try {
      const owner = await UserModel.findById(ownerId).select("email").lean();
      const email = (owner as any)?.email;
      if (email && (config.email.enabled || config.email.resendApiKey)) {
        await NotificationService.sendEmail({
          to: [email],
          subject: `[Apperio] ${headline}`,
          text: `${message}\n\nFirst seen: ${group.firstSeen.toISOString()}\nOccurrences: ${group.count}\n\nView it in Apperio: ${groupUrl}`,
          html: `
            <div style="font-family: sans-serif; max-width: 560px;">
              <h2 style="color: #0b1220;">${headline}</h2>
              <p style="font-size: 15px; color: #333;"><strong>${this.escapeHtml(group.title)}</strong></p>
              <p style="color: #555;">
                ${environment ? `Environment: ${this.escapeHtml(environment)}<br/>` : ""}
                Occurrences so far: ${group.count}<br/>
                First seen: ${group.firstSeen.toUTCString()}
              </p>
              <p>
                <a href="${groupUrl}" style="background: #00d97e; color: #06251a; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-weight: 600;">
                  View error in Apperio
                </a>
              </p>
              <p style="color: #999; font-size: 12px;">You get this because you own ${this.escapeHtml(projectName)} on Apperio. Disable in project settings.</p>
            </div>
          `,
        });
      }
    } catch (error) {
      logger.warn("ErrorGroupService: owner email failed", {
        errorGroupId: String(group._id),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private static escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ------------------------------------------------------------------
  // Reads & status
  // ------------------------------------------------------------------

  static async getGroups(
    projectId: string,
    opts: {
      page?: number;
      limit?: number;
      status?: string;
      environment?: string;
      search?: string;
      sort?: "lastSeen" | "count" | "firstSeen" | "sessionCount";
    } = {}
  ): Promise<{
    items: IErrorGroup[];
    meta: { page: number; limit: number; total: number };
    stats: { unresolved: number; resolved: number; ignored: number };
  }> {
    this.validateObjectId(projectId);
    const page = Math.max(1, opts.page || 1);
    const limit = Math.min(50, Math.max(1, opts.limit || 20));

    const filter: Record<string, any> = { projectId };
    if (opts.status && ["unresolved", "resolved", "ignored"].includes(opts.status)) {
      filter.status = opts.status;
    }
    if (opts.environment) filter.environments = opts.environment;
    if (opts.search) {
      filter.title = {
        $regex: opts.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        $options: "i",
      };
    }

    const sortField = opts.sort || "lastSeen";
    const [items, total, statusCounts] = await Promise.all([
      ErrorGroupModel.find(filter)
        .sort({ [sortField]: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<IErrorGroup[]>(),
      ErrorGroupModel.countDocuments(filter),
      ErrorGroupModel.aggregate([
        { $match: { projectId } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);

    const stats = { unresolved: 0, resolved: 0, ignored: 0 };
    for (const s of statusCounts) {
      if (s._id in stats) (stats as any)[s._id] = s.count;
    }

    return { items, meta: { page, limit, total }, stats };
  }

  static async getGroupDetail(
    projectId: string,
    groupId: string
  ): Promise<{ group: IErrorGroup; recentEvents: ILog[] }> {
    this.validateObjectId(projectId);
    this.validateObjectId(groupId);

    const group = await ErrorGroupModel.findOne({
      _id: groupId,
      projectId,
    });
    if (!group) throw new Error("Error group not found");

    const recentEvents = await LogModel.find({
      projectId,
      fingerprint: group.fingerprint,
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean<ILog[]>();

    // Lazily compute suspect commits in the background
    if (!group.suspectCommitsComputedAt) {
      aiQueue.enqueue(`suspects:${groupId}`, () =>
        this.computeSuspectCommits(projectId, String(group._id))
      );
    }

    return { group, recentEvents };
  }

  static async updateStatus(
    projectId: string,
    groupId: string,
    status: "unresolved" | "resolved" | "ignored",
    userId?: string
  ): Promise<IErrorGroup> {
    this.validateObjectId(projectId);
    this.validateObjectId(groupId);

    const update: Record<string, any> = { status };
    if (status === "resolved") {
      update.resolvedAt = new Date();
      update.resolvedBy = userId || "user";
      update.regressed = false;
    }

    const group = await ErrorGroupModel.findOneAndUpdate(
      { _id: groupId, projectId },
      { $set: update },
      { new: true }
    );
    if (!group) throw new Error("Error group not found");
    return group;
  }

  // ------------------------------------------------------------------
  // GitHub issue flow
  // ------------------------------------------------------------------

  /**
   * Build the AI-prefilled issue draft (no side effects — the user reviews
   * and can edit before creating).
   */
  static async getIssueDraft(
    projectId: string,
    groupId: string
  ): Promise<{ title: string; body: string; source: "ai" | "template" }> {
    this.validateObjectId(projectId);
    const group = await ErrorGroupModel.findOne({ _id: groupId, projectId });
    if (!group) throw new Error("Error group not found");

    const groupUrl = `${config.frontend.url}/projects/${projectId}/issues?group=${group._id}`;

    const context = {
      title: group.title,
      message: group.sampleMessage,
      stack: group.sampleStack?.slice(0, 4000),
      count: group.count,
      sessionCount: group.sessionCount,
      firstSeen: group.firstSeen.toISOString(),
      lastSeen: group.lastSeen.toISOString(),
      environments: group.environments,
      releaseFirstSeen: group.releaseFirstSeen,
      suspectCommits: group.suspectCommits?.map((s) => ({
        sha: s.sha.slice(0, 7),
        message: s.message,
        rationale: s.rationale,
      })),
      apperioUrl: groupUrl,
    };

    const draft = await AIService.draftIssueFromError(context, projectId);
    if (draft) return { ...draft, source: "ai" };

    // Deterministic fallback template
    const body = [
      `## Summary`,
      ``,
      `\`${group.title}\``,
      ``,
      `## Impact`,
      ``,
      `- Occurrences: **${group.count}**`,
      `- Sessions affected: **${group.sessionCount}**`,
      `- Environments: ${group.environments.join(", ") || "unknown"}`,
      `- First seen: ${group.firstSeen.toUTCString()}${group.releaseFirstSeen ? ` (release \`${group.releaseFirstSeen}\`)` : ""}`,
      `- Last seen: ${group.lastSeen.toUTCString()}`,
      ``,
      ...(group.sampleStack
        ? ["## Stack trace", "", "```", group.sampleStack.slice(0, 3000), "```", ""]
        : []),
      ...(group.suspectCommits && group.suspectCommits.length > 0
        ? [
            "## Possible cause",
            "",
            ...group.suspectCommits.map(
              (s) => `- \`${s.sha.slice(0, 7)}\` ${s.message?.split("\n")[0] || ""}${s.rationale ? ` — ${s.rationale}` : ""}`
            ),
            "",
          ]
        : []),
      `---`,
      `Tracked by [Apperio](${groupUrl})`,
    ].join("\n");

    return {
      title: group.title.slice(0, 80),
      body,
      source: "template",
    };
  }

  /**
   * Create the GitHub issue and link it to the group. Idempotent: if the
   * group already has a linked issue, returns it instead of duplicating.
   */
  static async createIssue(
    projectId: string,
    groupId: string,
    opts: { title?: string; body?: string; labels?: string[]; userId?: string }
  ): Promise<{
    issue: { number: number; url: string };
    alreadyLinked: boolean;
  }> {
    this.validateObjectId(projectId);
    const group = await ErrorGroupModel.findOne({ _id: groupId, projectId });
    if (!group) throw new Error("Error group not found");

    if (group.linkedIssue) {
      return {
        issue: {
          number: group.linkedIssue.number,
          url: group.linkedIssue.url,
        },
        alreadyLinked: true,
      };
    }

    const project = await ProjectModel.findById(projectId)
      .select("integrationSettings ownerId")
      .lean();
    const link = (project as any)?.integrationSettings?.githubRepo;
    if (!link?.owner || !link.repo) {
      throw new Error("No GitHub repo linked to this project");
    }

    // Prefer App installation; fall back to the acting user's OAuth token,
    // then to whoever linked the repo.
    let resolved = await GithubAppService.getTokenForRepo(
      link.owner,
      link.repo,
      opts.userId
    );
    if (!resolved && link.linkedBy) {
      resolved = await GithubAppService.getTokenForRepo(
        link.owner,
        link.repo,
        link.linkedBy.toString()
      );
    }
    if (!resolved) {
      throw new Error(
        "No GitHub access available. Install the Apperio GitHub App or connect GitHub."
      );
    }

    let title = opts.title;
    let body = opts.body;
    if (!title || !body) {
      const draft = await this.getIssueDraft(projectId, groupId);
      title = title || draft.title;
      body = body || draft.body;
    }

    const issue = await githubCreateIssue(resolved.token, link.owner, link.repo, {
      title,
      body,
      labels: opts.labels && opts.labels.length > 0 ? opts.labels : ["bug", "apperio"],
    });

    group.linkedIssue = {
      provider: "github",
      repo: `${link.owner}/${link.repo}`,
      number: issue.number,
      url: issue.html_url,
      state: "open",
      linkedAt: new Date(),
      linkedBy: opts.userId ? new Types.ObjectId(opts.userId) : undefined,
    };
    await group.save();

    return {
      issue: { number: issue.number, url: issue.html_url },
      alreadyLinked: false,
    };
  }

  /**
   * Two-way sync from the `issues` webhook: closing the linked issue
   * resolves the group; reopening it unresolves.
   */
  static async handleIssueWebhook(
    repoFullName: string,
    payload: any
  ): Promise<void> {
    const action = payload?.action;
    const issueNumber = payload?.issue?.number;
    if (!issueNumber || !["closed", "reopened"].includes(action)) return;

    const groups = await ErrorGroupModel.find({
      "linkedIssue.repo": repoFullName,
      "linkedIssue.number": issueNumber,
    });

    for (const group of groups) {
      if (action === "closed") {
        group.status = "resolved";
        group.resolvedAt = new Date();
        group.resolvedBy = "github";
        group.regressed = false;
        group.linkedIssue!.state = "closed";
      } else {
        group.status = "unresolved";
        group.linkedIssue!.state = "open";
      }
      await group.save();

      logger.info("ErrorGroupService: issue sync applied", {
        errorGroupId: String(group._id),
        action,
        issue: `${repoFullName}#${issueNumber}`,
      });
    }
  }

  // ------------------------------------------------------------------
  // Suspect commits (Phase 7.5)
  // ------------------------------------------------------------------

  /**
   * Rank recent commits by likelihood of having introduced this error.
   * Heuristic pass (stack-file overlap + recency) narrows candidates,
   * an optional AI pass refines ranking and writes rationales.
   */
  static async computeSuspectCommits(
    projectId: string,
    groupId: string
  ): Promise<void> {
    try {
      const group = await ErrorGroupModel.findOne({ _id: groupId, projectId });
      if (!group || group.suspectCommitsComputedAt) return;

      const windowStart = new Date(
        group.firstSeen.getTime() - SUSPECT_WINDOW_DAYS * 24 * 60 * 60 * 1000
      );

      const candidates = await CommitModel.find({
        projectId,
        committedAt: { $gte: windowStart, $lte: group.firstSeen },
      })
        .sort({ committedAt: -1 })
        .limit(SUSPECT_CANDIDATE_LIMIT)
        .lean();

      if (candidates.length === 0) {
        group.suspectCommitsComputedAt = new Date();
        await group.save();
        return;
      }

      const stackPaths = FingerprintService.stackFilePaths(
        group.sampleStack || ""
      );
      const stackBasenames = new Set(
        stackPaths.map((p) => p.split("/").pop()?.toLowerCase()).filter(Boolean)
      );

      // Heuristic scoring
      const scored = candidates.map((commit: any, index: number) => {
        let score = 0;
        const files: string[] = (commit.files || []).map(
          (f: any) => f.filename
        );
        for (const file of files) {
          const base = file.split("/").pop()?.toLowerCase();
          if (base && stackBasenames.has(base)) score += 40;
        }
        // Recency: newest candidate gets up to +20
        score += Math.max(0, 20 - index * 2);
        return { commit, score, files };
      });

      scored.sort((a, b) => b.score - a.score);
      const top = scored.slice(0, 10);

      // AI refinement (optional)
      const aiRanking = await AIService.rankSuspectCommits(
        {
          errorTitle: group.title,
          stack: group.sampleStack?.slice(0, 2000),
          candidates: top.map((s) => ({
            sha: s.commit.sha,
            message: s.commit.message.split("\n")[0].slice(0, 150),
            files: s.files.slice(0, 20),
          })),
        },
        projectId
      );

      let suspects;
      if (aiRanking && aiRanking.length > 0) {
        const bySha = new Map(top.map((s) => [s.commit.sha, s.commit]));
        suspects = aiRanking
          .filter((r) => bySha.has(r.sha))
          .slice(0, 3)
          .map((r) => {
            const commit = bySha.get(r.sha)!;
            return {
              sha: r.sha,
              score: Math.min(100, Math.max(0, r.score)),
              rationale: r.rationale,
              message: commit.message.split("\n")[0].slice(0, 150),
              htmlUrl: commit.htmlUrl,
              authorLogin: commit.authorLogin,
            };
          });
      } else {
        // Heuristic-only fallback: require a stack-file match
        suspects = top
          .filter((s) => s.score >= 40)
          .slice(0, 3)
          .map((s) => ({
            sha: s.commit.sha,
            score: Math.min(100, s.score),
            rationale: "Touched files that appear in the error's stack trace.",
            message: s.commit.message.split("\n")[0].slice(0, 150),
            htmlUrl: s.commit.htmlUrl,
            authorLogin: s.commit.authorLogin,
          }));
      }

      group.suspectCommits = suspects;
      group.suspectCommitsComputedAt = new Date();
      await group.save();
    } catch (error) {
      logger.error("ErrorGroupService: suspect computation failed", {
        projectId,
        groupId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private static validateObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error(`Invalid ObjectId: ${id}`);
    }
  }
}
