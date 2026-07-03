/**
 * ChangeService — Change Intelligence commit ingestion and feed.
 *
 * Commits arrive via GitHub `push` webhooks (or backfill on repo link),
 * are persisted per project, and get AI-written plain-English summaries
 * generated asynchronously on the AI task queue.
 */
import { Types } from "mongoose";
import { CommitModel, ICommitFile } from "../models/commit.model";
import { DeploymentModel } from "../models/deployment.model";
import { ProjectModel } from "../models/project.model";
import { AIService } from "../utils/ai/ai.service";
import { GithubAppService } from "./integrations/github-app.service";
import {
  getCommitDetail,
  listRecentCommits,
  listReleases,
} from "./integrations/github-client";
import { DeploymentService } from "./deployment.service";
import { aiQueue } from "../utils/task-queue";
import logger from "../utils/logger";

/** Max commits summarized per push (protects the AI budget on huge pushes). */
const MAX_COMMITS_PER_SUMMARY_BATCH = 10;
/** Max diff excerpt per commit sent to the AI. */
const MAX_PATCH_CHARS_PER_COMMIT = 8_000;
/** Files that never contribute diff content to summaries. */
const IGNORED_FILE_PATTERNS = [
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /\.min\.(js|css)$/,
  /^dist\//,
  /^build\//,
  /^node_modules\//,
  /\.map$/,
  /\.(png|jpe?g|gif|svg|ico|woff2?|ttf|eot)$/i,
];
/** Cap the stored per-commit file list. */
const MAX_FILES_STORED = 50;
/** How many commits to import when a repo is first linked. */
const BACKFILL_COMMIT_COUNT = 50;
/** How many of the backfilled commits get AI summaries. */
const BACKFILL_SUMMARY_COUNT = 10;

interface LinkedProject {
  projectId: string;
  owner: string;
  repo: string;
  branch: string;
  tokenUserId?: string;
}

export class ChangeService {
  /** All projects linked to a GitHub repo (a repo may back several projects). */
  static async findProjectsForRepo(
    owner: string,
    repo: string
  ): Promise<LinkedProject[]> {
    const projects = await ProjectModel.find({
      "integrationSettings.githubRepo.owner": owner,
      "integrationSettings.githubRepo.repo": repo,
    })
      .select("integrationSettings ownerId")
      .lean();

    return projects.map((p: any) => ({
      projectId: String(p._id),
      owner,
      repo,
      branch: p.integrationSettings?.githubRepo?.branch || "main",
      tokenUserId:
        p.integrationSettings?.githubRepo?.linkedBy?.toString() ||
        p.ownerId?.toString(),
    }));
  }

  // ------------------------------------------------------------------
  // Push webhook ingestion
  // ------------------------------------------------------------------

  static async handlePushEvent(payload: any): Promise<void> {
    const fullName: string = payload?.repository?.full_name || "";
    const [owner, repo] = fullName.split("/");
    if (!owner || !repo) return;

    const ref: string = payload?.ref || "";
    const branch = ref.replace(/^refs\/heads\//, "");
    const commits: any[] = Array.isArray(payload?.commits)
      ? payload.commits
      : [];
    if (commits.length === 0) return;

    const linkedProjects = await this.findProjectsForRepo(owner, repo);
    if (linkedProjects.length === 0) return;

    const pushId: string = payload?.after || commits[commits.length - 1]?.id;

    for (const project of linkedProjects) {
      // Only track the linked branch (defaults to the repo's main branch)
      if (branch && project.branch && branch !== project.branch) continue;

      const shas: string[] = [];
      for (const c of commits) {
        if (!c?.id) continue;
        const files = this.filesFromPushCommit(c);
        try {
          await CommitModel.updateOne(
            { projectId: project.projectId, sha: c.id },
            {
              $setOnInsert: {
                projectId: project.projectId,
                sha: c.id,
                message: c.message || "(no message)",
                authorName: c.author?.name || c.author?.username || "unknown",
                authorEmail: c.author?.email,
                authorLogin: c.author?.username,
                committedAt: c.timestamp ? new Date(c.timestamp) : new Date(),
                branch,
                htmlUrl: c.url,
                filesChanged: files.length,
                files: files.slice(0, MAX_FILES_STORED),
                pushId,
                aiSummaryStatus: AIService.isAvailable() ? "pending" : "skipped",
                source: "webhook",
              },
            },
            { upsert: true }
          );
          shas.push(c.id);
        } catch (error: any) {
          // Duplicate key = already ingested (webhook redelivery); safe to skip
          if (error?.code !== 11000) {
            logger.error("ChangeService: commit upsert failed", {
              projectId: project.projectId,
              sha: c.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      if (shas.length > 0 && AIService.isAvailable()) {
        const { projectId, tokenUserId } = project;
        aiQueue.enqueue(`summarize-push:${projectId}:${pushId}`, () =>
          this.summarizeCommits(projectId, owner, repo, shas, tokenUserId)
        );
      }
    }
  }

  private static filesFromPushCommit(commit: any): ICommitFile[] {
    const files: ICommitFile[] = [];
    for (const f of commit.added || []) files.push({ filename: f, status: "added" });
    for (const f of commit.modified || []) files.push({ filename: f, status: "modified" });
    for (const f of commit.removed || []) files.push({ filename: f, status: "removed" });
    return files;
  }

  // ------------------------------------------------------------------
  // Backfill on repo link
  // ------------------------------------------------------------------

  /**
   * Import recent commits + releases when a repo is linked so the feed is
   * never empty. Fire-and-forget from the link endpoint.
   */
  static async backfillProject(projectId: string): Promise<void> {
    const project = await ProjectModel.findById(projectId)
      .select("integrationSettings ownerId")
      .lean();
    const link = (project as any)?.integrationSettings?.githubRepo;
    if (!link?.owner || !link.repo) return;

    const tokenUserId =
      link.linkedBy?.toString() || (project as any).ownerId?.toString();
    const resolved = await GithubAppService.getTokenForRepo(
      link.owner,
      link.repo,
      tokenUserId
    );
    if (!resolved) {
      logger.warn("ChangeService: backfill skipped — no GitHub token", {
        projectId,
      });
      return;
    }

    try {
      const commits = await listRecentCommits(
        resolved.token,
        link.owner,
        link.repo,
        { branch: link.branch || "main", perPage: BACKFILL_COMMIT_COUNT }
      );

      const summarizable: string[] = [];
      for (let i = 0; i < commits.length; i++) {
        const c = commits[i];
        const wantsSummary =
          i < BACKFILL_SUMMARY_COUNT && AIService.isAvailable();
        try {
          await CommitModel.updateOne(
            { projectId, sha: c.sha },
            {
              $setOnInsert: {
                projectId,
                sha: c.sha,
                message: c.commit.message || "(no message)",
                authorName: c.commit.author?.name || "unknown",
                authorEmail: c.commit.author?.email,
                authorLogin: c.author?.login,
                authorAvatarUrl: c.author?.avatar_url,
                committedAt: c.commit.author?.date
                  ? new Date(c.commit.author.date)
                  : new Date(),
                branch: link.branch || "main",
                htmlUrl: c.html_url,
                aiSummaryStatus: wantsSummary ? "pending" : "skipped",
                source: "backfill",
              },
            },
            { upsert: true }
          );
          if (wantsSummary) summarizable.push(c.sha);
        } catch (error: any) {
          if (error?.code !== 11000) throw error;
        }
      }

      if (summarizable.length > 0) {
        aiQueue.enqueue(`summarize-backfill:${projectId}`, () =>
          this.summarizeCommits(
            projectId,
            link.owner,
            link.repo,
            summarizable,
            tokenUserId
          )
        );
      }

      // Import published releases into the deployments collection
      try {
        const releases = await listReleases(
          resolved.token,
          link.owner,
          link.repo
        );
        await DeploymentService.upsertGithubReleases(projectId, releases);
      } catch (error) {
        logger.warn("ChangeService: release backfill failed", {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      logger.info("ChangeService: backfill complete", {
        projectId,
        commits: commits.length,
      });
    } catch (error) {
      logger.error("ChangeService: backfill failed", {
        projectId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // ------------------------------------------------------------------
  // AI summarization
  // ------------------------------------------------------------------

  /**
   * Fetch diffs for a set of commits and store AI summaries.
   * Runs on the AI queue; failures mark commits "failed" so the UI can
   * offer a manual retry.
   */
  static async summarizeCommits(
    projectId: string,
    owner: string,
    repo: string,
    shas: string[],
    tokenUserId?: string
  ): Promise<void> {
    const batch = shas.slice(0, MAX_COMMITS_PER_SUMMARY_BATCH);
    const resolved = await GithubAppService.getTokenForRepo(
      owner,
      repo,
      tokenUserId
    );
    if (!resolved) {
      await CommitModel.updateMany(
        { projectId, sha: { $in: batch }, aiSummaryStatus: "pending" },
        { $set: { aiSummaryStatus: "skipped" } }
      );
      return;
    }

    const items: Array<{ sha: string; message: string; diffExcerpt: string }> =
      [];
    for (const sha of batch) {
      try {
        const detail = await getCommitDetail(resolved.token, owner, repo, sha);
        const excerpt = this.buildDiffExcerpt(detail.files || []);
        items.push({
          sha,
          message: detail.commit?.message || "(no message)",
          diffExcerpt: excerpt,
        });
        // Enrich stored stats while we have the detail response
        await CommitModel.updateOne(
          { projectId, sha },
          {
            $set: {
              additions: detail.stats?.additions,
              deletions: detail.stats?.deletions,
              filesChanged: detail.files?.length,
              authorAvatarUrl: detail.author?.avatar_url,
              authorLogin: detail.author?.login,
            },
          }
        );
      } catch (error) {
        logger.warn("ChangeService: commit detail fetch failed", {
          projectId,
          sha,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (items.length === 0) {
      await CommitModel.updateMany(
        { projectId, sha: { $in: batch }, aiSummaryStatus: "pending" },
        { $set: { aiSummaryStatus: "failed" } }
      );
      return;
    }

    const summaries = await AIService.summarizeCommitBatch(items, projectId);
    if (!summaries) {
      await CommitModel.updateMany(
        { projectId, sha: { $in: batch }, aiSummaryStatus: "pending" },
        { $set: { aiSummaryStatus: "failed" } }
      );
      return;
    }

    for (const s of summaries) {
      if (!s?.sha) continue;
      await CommitModel.updateOne(
        { projectId, sha: s.sha },
        {
          $set: {
            aiSummary: s.summary,
            aiTechnicalSummary: s.technicalSummary,
            aiSummaryStatus: "complete",
          },
        }
      );
    }

    // Anything the model failed to cover
    const covered = new Set(summaries.map((s) => s.sha));
    const missing = batch.filter((sha) => !covered.has(sha));
    if (missing.length > 0) {
      await CommitModel.updateMany(
        { projectId, sha: { $in: missing }, aiSummaryStatus: "pending" },
        { $set: { aiSummaryStatus: "failed" } }
      );
    }
  }

  /** Build a truncated, noise-filtered diff excerpt for one commit. */
  private static buildDiffExcerpt(
    files: Array<{ filename: string; status: string; patch?: string; additions?: number; deletions?: number }>
  ): string {
    const parts: string[] = [];
    let budget = MAX_PATCH_CHARS_PER_COMMIT;

    for (const file of files) {
      if (budget <= 0) break;
      const ignored = IGNORED_FILE_PATTERNS.some((re) => re.test(file.filename));
      const header = `--- ${file.filename} (${file.status}, +${file.additions ?? 0}/-${file.deletions ?? 0})`;
      if (ignored || !file.patch) {
        parts.push(header);
        budget -= header.length;
        continue;
      }
      const slice = file.patch.slice(0, Math.min(budget, 2_000));
      parts.push(`${header}\n${slice}`);
      budget -= header.length + slice.length;
    }

    return parts.join("\n");
  }

  // ------------------------------------------------------------------
  // Feed queries
  // ------------------------------------------------------------------

  /**
   * Unified change feed: commits merged with deployments/releases,
   * newest first. Uses $unionWith so pagination stays correct across
   * both collections.
   */
  static async getChanges(
    projectId: string,
    opts: {
      page?: number;
      limit?: number;
      type?: "commit" | "deployment" | "release";
      author?: string;
      from?: Date;
      to?: Date;
    } = {}
  ): Promise<{ items: any[]; meta: { page: number; limit: number; total: number } }> {
    this.validateObjectId(projectId);
    const page = Math.max(1, opts.page || 1);
    const limit = Math.min(50, Math.max(1, opts.limit || 20));
    const skip = (page - 1) * limit;

    const commitMatch: Record<string, any> = { projectId };
    const deployMatch: Record<string, any> = { projectId };
    if (opts.author) {
      commitMatch.$or = [
        { authorLogin: opts.author },
        { authorName: opts.author },
      ];
      deployMatch.deployedBy = opts.author;
    }
    if (opts.from || opts.to) {
      const range: Record<string, Date> = {};
      if (opts.from) range.$gte = opts.from;
      if (opts.to) range.$lte = opts.to;
      commitMatch.committedAt = range;
      deployMatch.startedAt = range;
    }
    if (opts.type === "deployment" || opts.type === "release") {
      deployMatch.kind = opts.type;
    }

    const wantCommits = !opts.type || opts.type === "commit";
    const wantDeploys = !opts.type || opts.type !== "commit";

    const commitPipeline: any[] = [
      { $match: commitMatch },
      { $addFields: { itemType: "commit", date: "$committedAt" } },
    ];
    const deployPipeline: any[] = [
      { $match: deployMatch },
      { $addFields: { itemType: "$kind", date: "$startedAt" } },
    ];

    let pipeline: any[];
    if (wantCommits && wantDeploys) {
      pipeline = [
        ...commitPipeline,
        { $unionWith: { coll: "deployments", pipeline: deployPipeline } },
      ];
    } else if (wantCommits) {
      pipeline = commitPipeline;
    } else {
      // Deploy-only queries run directly against the deployments collection
      const [items, total] = await Promise.all([
        DeploymentModel.aggregate([
          ...deployPipeline,
          { $sort: { date: -1 } },
          { $skip: skip },
          { $limit: limit },
        ]),
        DeploymentModel.countDocuments(deployMatch),
      ]);
      return { items, meta: { page, limit, total } };
    }

    const items = await CommitModel.aggregate([
      ...pipeline,
      { $sort: { date: -1 } },
      { $skip: skip },
      { $limit: limit },
    ]);

    const [commitTotal, deployTotal] = await Promise.all([
      wantCommits ? CommitModel.countDocuments(commitMatch) : 0,
      wantDeploys ? DeploymentModel.countDocuments(deployMatch) : 0,
    ]);

    return {
      items,
      meta: { page, limit, total: commitTotal + deployTotal },
    };
  }

  /**
   * On-demand deeper explanation of a single commit ("Explain this change").
   * Cached on the commit document.
   */
  static async explainChange(
    projectId: string,
    sha: string
  ): Promise<{ explanation: string; source: "ai" | "cache" | "unavailable" }> {
    this.validateObjectId(projectId);
    const commit = await CommitModel.findOne({ projectId, sha });
    if (!commit) {
      throw new Error("Commit not found");
    }
    if (commit.aiExplanation) {
      return { explanation: commit.aiExplanation, source: "cache" };
    }

    const project = await ProjectModel.findById(projectId)
      .select("integrationSettings ownerId")
      .lean();
    const link = (project as any)?.integrationSettings?.githubRepo;
    if (!link?.owner || !link.repo) {
      throw new Error("No GitHub repo linked to this project");
    }

    const tokenUserId =
      link.linkedBy?.toString() || (project as any).ownerId?.toString();
    const resolved = await GithubAppService.getTokenForRepo(
      link.owner,
      link.repo,
      tokenUserId
    );

    let diffExcerpt = "";
    if (resolved) {
      try {
        const detail = await getCommitDetail(
          resolved.token,
          link.owner,
          link.repo,
          sha
        );
        diffExcerpt = this.buildDiffExcerpt(detail.files || []);
      } catch {
        // Explanation still works from the message alone
      }
    }

    const explanation = await AIService.explainCommit(
      { sha, message: commit.message, diffExcerpt },
      projectId
    );
    if (!explanation) {
      return {
        explanation:
          "AI explanation is not available right now. The commit message: " +
          commit.message,
        source: "unavailable",
      };
    }

    commit.aiExplanation = explanation;
    await commit.save();
    return { explanation, source: "ai" };
  }

  /** Retry AI summarization for commits stuck in failed/skipped states. */
  static async retrySummaries(projectId: string, shas: string[]): Promise<void> {
    this.validateObjectId(projectId);
    const project = await ProjectModel.findById(projectId)
      .select("integrationSettings ownerId")
      .lean();
    const link = (project as any)?.integrationSettings?.githubRepo;
    if (!link?.owner || !link.repo) return;

    await CommitModel.updateMany(
      { projectId, sha: { $in: shas } },
      { $set: { aiSummaryStatus: "pending" } }
    );
    const tokenUserId =
      link.linkedBy?.toString() || (project as any).ownerId?.toString();
    aiQueue.enqueue(`summarize-retry:${projectId}`, () =>
      this.summarizeCommits(projectId, link.owner, link.repo, shas, tokenUserId)
    );
  }

  private static validateObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error(`Invalid ObjectId: ${id}`);
    }
  }
}
