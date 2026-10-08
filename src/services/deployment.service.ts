/**
 * DeploymentService — deploy/release tracking and impact verdicts.
 *
 * Deployments arrive from GitHub `deployment`/`deployment_status`/`release`
 * webhooks or the manual API-key endpoint (for CI systems outside GitHub).
 * Impact is computed lazily on read once the post-deploy window has elapsed,
 * comparing error rate and response time before vs. after the deploy.
 */
import { Types } from "mongoose";
import {
  DeploymentModel,
  IDeployment,
  IDeploymentImpactWindow,
} from "../models/deployment.model";
import { LogModel } from "../models/log.model";
import { ErrorGroupModel } from "../models/errorGroup.model";
import {
  GithubDeployment,
  GithubDeploymentStatus,
  GithubRelease,
} from "./integrations/github-client";
import logger from "../utils/logger";

const IMPACT_WINDOW_MINUTES = 60;
/** Relative error-rate change that flips the verdict. */
const VERDICT_THRESHOLD_PCT = 25;
/** Minimum traffic for a confident verdict. */
const MIN_LOGS_FOR_VERDICT = 10;
/** Max lazy impact computations per read request. */
const MAX_IMPACT_COMPUTES_PER_READ = 5;

export class DeploymentService {
  // ------------------------------------------------------------------
  // Webhook ingestion
  // ------------------------------------------------------------------

  static async handleDeploymentEvent(
    projectId: string,
    payload: any
  ): Promise<void> {
    const dep = payload?.deployment;
    if (!dep?.id) return;

    await DeploymentModel.updateOne(
      { projectId, githubDeploymentId: dep.id },
      {
        $setOnInsert: {
          projectId,
          kind: "deployment",
          provider: "github",
          githubDeploymentId: dep.id,
          startedAt: dep.created_at ? new Date(dep.created_at) : new Date(),
        },
        $set: {
          environment: dep.environment || "production",
          sha: dep.sha,
          release: dep.ref && dep.ref !== dep.sha ? dep.ref : undefined,
          description: dep.description || undefined,
          deployedBy: dep.creator?.login,
          status: "pending",
        },
      },
      { upsert: true }
    );
  }

  static async handleDeploymentStatusEvent(
    projectId: string,
    payload: any
  ): Promise<void> {
    const dep = payload?.deployment;
    const status = payload?.deployment_status;
    if (!dep?.id || !status?.state) return;

    const mapped = this.mapGithubState(status.state);
    const update: Record<string, any> = { status: mapped };
    if (status.environment_url) update.url = status.environment_url;
    if (mapped === "success" || mapped === "failure" || mapped === "error") {
      update.finishedAt = status.created_at
        ? new Date(status.created_at)
        : new Date();
    }

    await DeploymentModel.updateOne(
      { projectId, githubDeploymentId: dep.id },
      {
        $set: update,
        $setOnInsert: {
          projectId,
          kind: "deployment",
          provider: "github",
          githubDeploymentId: dep.id,
          environment: dep.environment || "production",
          sha: dep.sha,
          deployedBy: dep.creator?.login,
          startedAt: dep.created_at ? new Date(dep.created_at) : new Date(),
        },
      },
      { upsert: true }
    );
  }

  private static mapGithubState(state: string): IDeployment["status"] {
    switch (state) {
      case "success":
        return "success";
      case "failure":
        return "failure";
      case "error":
        return "error";
      case "inactive":
        return "inactive";
      case "in_progress":
      case "queued":
      case "pending":
      default:
        return "in_progress";
    }
  }

  static async handleReleaseEvent(
    projectId: string,
    payload: any
  ): Promise<void> {
    if (payload?.action !== "published") return;
    const release = payload?.release;
    if (!release?.id) return;
    await this.upsertGithubReleases(projectId, [release]);
  }

  /** Upsert published GitHub releases (webhook + backfill share this). */
  static async upsertGithubReleases(
    projectId: string,
    releases: GithubRelease[]
  ): Promise<void> {
    for (const release of releases) {
      if (!release?.id || !release.tag_name) continue;
      try {
        await DeploymentModel.updateOne(
          { projectId, githubReleaseId: release.id },
          {
            $setOnInsert: {
              projectId,
              kind: "release",
              provider: "github",
              githubReleaseId: release.id,
              environment: "production",
              status: "success",
              startedAt: release.published_at
                ? new Date(release.published_at)
                : new Date(),
            },
            $set: {
              release: release.tag_name,
              description: release.name || undefined,
              url: release.html_url,
              deployedBy: release.author?.login,
            },
          },
          { upsert: true }
        );
      } catch (error: any) {
        if (error?.code !== 11000) {
          logger.error("DeploymentService: release upsert failed", {
            projectId,
            releaseId: release.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  }

  /**
   * Upsert a deployment fetched from the GitHub API (backfill). Goes through
   * the webhook handlers so both paths store identical documents.
   */
  static async upsertGithubDeployment(
    projectId: string,
    deployment: GithubDeployment,
    latestStatus?: GithubDeploymentStatus
  ): Promise<void> {
    await this.handleDeploymentEvent(projectId, { deployment });
    if (latestStatus) {
      await this.handleDeploymentStatusEvent(projectId, {
        deployment,
        deployment_status: latestStatus,
      });
    }
  }

  // ------------------------------------------------------------------
  // Manual deploy notification (API-key authenticated, for external CI)
  // ------------------------------------------------------------------

  static async recordApiDeployment(
    projectId: string,
    body: {
      environment?: string;
      release?: string;
      sha?: string;
      url?: string;
      description?: string;
      status?: string;
      deployedBy?: string;
    }
  ): Promise<IDeployment> {
    this.validateObjectId(projectId);
    const status =
      body.status && ["success", "failure", "in_progress"].includes(body.status)
        ? (body.status as IDeployment["status"])
        : "success";

    const deployment = await DeploymentModel.create({
      projectId,
      kind: "deployment",
      provider: "api",
      environment: body.environment || "production",
      release: body.release,
      sha: body.sha,
      url: body.url,
      description: body.description,
      deployedBy: body.deployedBy,
      status,
      startedAt: new Date(),
      finishedAt: status === "in_progress" ? undefined : new Date(),
    });
    return deployment;
  }

  // ------------------------------------------------------------------
  // Reads
  // ------------------------------------------------------------------

  static async getDeployments(
    projectId: string,
    opts: { page?: number; limit?: number; environment?: string; kind?: string } = {}
  ): Promise<{ items: IDeployment[]; meta: { page: number; limit: number; total: number } }> {
    this.validateObjectId(projectId);
    const page = Math.max(1, opts.page || 1);
    const limit = Math.min(50, Math.max(1, opts.limit || 20));

    const filter: Record<string, any> = { projectId };
    if (opts.environment) filter.environment = opts.environment;
    if (opts.kind === "deployment" || opts.kind === "release") {
      filter.kind = opts.kind;
    }

    const [items, total] = await Promise.all([
      DeploymentModel.find(filter)
        .sort({ startedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      DeploymentModel.countDocuments(filter),
    ]);

    // Lazily compute impact for eligible deployments on this page
    let computes = 0;
    for (const dep of items) {
      if (computes >= MAX_IMPACT_COMPUTES_PER_READ) break;
      if (this.isImpactDue(dep)) {
        try {
          await this.computeImpact(dep);
          computes++;
        } catch (error) {
          logger.warn("DeploymentService: impact computation failed", {
            deploymentId: String(dep._id),
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    return { items, meta: { page, limit, total } };
  }

  /** Deploy markers for chart overlays. */
  static async getDeployMarkers(
    projectId: string,
    from: Date,
    to: Date
  ): Promise<
    Array<{
      date: Date;
      kind: string;
      environment: string;
      release?: string;
      status: string;
      verdict?: string;
    }>
  > {
    this.validateObjectId(projectId);
    const deployments = await DeploymentModel.find({
      projectId,
      startedAt: { $gte: from, $lte: to },
    })
      .select("startedAt kind environment release status impact.verdict")
      .sort({ startedAt: 1 })
      .lean();

    return deployments.map((d: any) => ({
      date: d.startedAt,
      kind: d.kind,
      environment: d.environment,
      release: d.release,
      status: d.status,
      verdict: d.impact?.verdict,
    }));
  }

  // ------------------------------------------------------------------
  // Impact verdicts
  // ------------------------------------------------------------------

  private static isImpactDue(dep: IDeployment): boolean {
    if (dep.impact?.verdict) return false;
    if (dep.kind !== "deployment") return false;
    if (dep.status !== "success") return false;
    const windowEnd =
      dep.startedAt.getTime() + IMPACT_WINDOW_MINUTES * 60 * 1000;
    return Date.now() > windowEnd;
  }

  /**
   * Compare the hour before the deploy against the hour after it.
   * Falls back to environment-unfiltered queries when the deploy
   * environment doesn't match any log environment names.
   */
  static async computeImpact(dep: IDeployment): Promise<void> {
    const windowMs = IMPACT_WINDOW_MINUTES * 60 * 1000;
    const start = dep.startedAt.getTime();

    let before = await this.aggregateWindow(
      dep.projectId,
      new Date(start - windowMs),
      new Date(start),
      dep.environment
    );
    let after = await this.aggregateWindow(
      dep.projectId,
      new Date(start),
      new Date(start + windowMs),
      dep.environment
    );

    // Environment name mismatch (e.g. GitHub env "Production — web") →
    // retry without the environment filter
    if (before.logCount === 0 && after.logCount === 0) {
      before = await this.aggregateWindow(
        dep.projectId,
        new Date(start - windowMs),
        new Date(start)
      );
      after = await this.aggregateWindow(
        dep.projectId,
        new Date(start),
        new Date(start + windowMs)
      );
    }

    const errorRateChangePct =
      before.errorRate > 0
        ? ((after.errorRate - before.errorRate) / before.errorRate) * 100
        : after.errorRate > 0
          ? 100
          : 0;
    const responseTimeChangePct =
      before.avgResponseTime && after.avgResponseTime
        ? ((after.avgResponseTime - before.avgResponseTime) /
            before.avgResponseTime) *
          100
        : null;

    let verdict: NonNullable<IDeployment["impact"]>["verdict"] = "unknown";
    const enoughTraffic =
      before.logCount >= MIN_LOGS_FOR_VERDICT &&
      after.logCount >= MIN_LOGS_FOR_VERDICT;

    if (enoughTraffic) {
      if (errorRateChangePct > VERDICT_THRESHOLD_PCT && after.errorCount >= 5) {
        verdict = "degraded";
      } else if (
        errorRateChangePct < -VERDICT_THRESHOLD_PCT &&
        before.errorCount >= 5
      ) {
        verdict = "improved";
      } else {
        verdict = "healthy";
      }
    } else if (
      before.logCount > 0 &&
      before.errorCount === 0 &&
      after.errorCount >= 5
    ) {
      // Low traffic but a clear new error burst. Needs some traffic before the
      // deploy: with none (a new project's first deploy) there is no baseline,
      // so errors afterwards say nothing about the deploy and stay "unknown".
      verdict = "degraded";
    }

    dep.impact = {
      verdict,
      computedAt: new Date(),
      windowMinutes: IMPACT_WINDOW_MINUTES,
      before,
      after,
      errorRateChangePct:
        Math.round(errorRateChangePct * 10) / 10,
      responseTimeChangePct:
        responseTimeChangePct === null
          ? null
          : Math.round(responseTimeChangePct * 10) / 10,
    };
    await dep.save();
  }

  private static async aggregateWindow(
    projectId: string,
    from: Date,
    to: Date,
    environment?: string
  ): Promise<IDeploymentImpactWindow> {
    const match: Record<string, any> = {
      projectId,
      createdAt: { $gte: from, $lt: to },
    };
    if (environment) match.environment = environment;

    const [result] = await LogModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          logCount: { $sum: 1 },
          errorCount: {
            $sum: {
              $cond: [{ $in: ["$level", ["error", "fatal"]] }, 1, 0],
            },
          },
          avgResponseTime: { $avg: "$responseTime" },
        },
      },
    ]);

    const logCount = result?.logCount || 0;
    const errorCount = result?.errorCount || 0;
    return {
      logCount,
      errorCount,
      errorRate: logCount > 0 ? errorCount / logCount : 0,
      avgResponseTime:
        typeof result?.avgResponseTime === "number"
          ? Math.round(result.avgResponseTime)
          : null,
    };
  }

  // ------------------------------------------------------------------
  // Release health
  // ------------------------------------------------------------------

  static async getReleaseHealth(
    projectId: string,
    release: string
  ): Promise<{
    release: string;
    logCount: number;
    errorCount: number;
    errorRate: number;
    sessionCount: number;
    newErrorGroups: number;
    deployments: Array<{ startedAt: Date; environment: string; status: string }>;
  }> {
    this.validateObjectId(projectId);

    const [stats] = await LogModel.aggregate([
      { $match: { projectId, release } },
      {
        $group: {
          _id: null,
          logCount: { $sum: 1 },
          errorCount: {
            $sum: { $cond: [{ $in: ["$level", ["error", "fatal"]] }, 1, 0] },
          },
          sessions: { $addToSet: "$sessionId" },
        },
      },
    ]);

    const newErrorGroups = await ErrorGroupModel.countDocuments({
      projectId,
      releaseFirstSeen: release,
    });

    const deployments = await DeploymentModel.find({ projectId, release })
      .select("startedAt environment status")
      .sort({ startedAt: -1 })
      .lean();

    const logCount = stats?.logCount || 0;
    const errorCount = stats?.errorCount || 0;
    const sessionCount = (stats?.sessions || []).filter(Boolean).length;

    return {
      release,
      logCount,
      errorCount,
      errorRate: logCount > 0 ? errorCount / logCount : 0,
      sessionCount,
      newErrorGroups,
      deployments: deployments.map((d: any) => ({
        startedAt: d.startedAt,
        environment: d.environment,
        status: d.status,
      })),
    };
  }

  private static validateObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error(`Invalid ObjectId: ${id}`);
    }
  }
}
