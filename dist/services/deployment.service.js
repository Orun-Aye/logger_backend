"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeploymentService = void 0;
/**
 * DeploymentService — deploy/release tracking and impact verdicts.
 *
 * Deployments arrive from GitHub `deployment`/`deployment_status`/`release`
 * webhooks or the manual API-key endpoint (for CI systems outside GitHub).
 * Impact is computed lazily on read once the post-deploy window has elapsed,
 * comparing error rate and response time before vs. after the deploy.
 */
const mongoose_1 = require("mongoose");
const deployment_model_1 = require("../models/deployment.model");
const log_model_1 = require("../models/log.model");
const errorGroup_model_1 = require("../models/errorGroup.model");
const logger_1 = __importDefault(require("../utils/logger"));
const IMPACT_WINDOW_MINUTES = 60;
/** Relative error-rate change that flips the verdict. */
const VERDICT_THRESHOLD_PCT = 25;
/** Minimum traffic for a confident verdict. */
const MIN_LOGS_FOR_VERDICT = 10;
/** Max lazy impact computations per read request. */
const MAX_IMPACT_COMPUTES_PER_READ = 5;
class DeploymentService {
    // ------------------------------------------------------------------
    // Webhook ingestion
    // ------------------------------------------------------------------
    static async handleDeploymentEvent(projectId, payload) {
        const dep = payload?.deployment;
        if (!dep?.id)
            return;
        await deployment_model_1.DeploymentModel.updateOne({ projectId, githubDeploymentId: dep.id }, {
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
        }, { upsert: true });
    }
    static async handleDeploymentStatusEvent(projectId, payload) {
        const dep = payload?.deployment;
        const status = payload?.deployment_status;
        if (!dep?.id || !status?.state)
            return;
        const mapped = this.mapGithubState(status.state);
        const update = { status: mapped };
        if (status.environment_url)
            update.url = status.environment_url;
        if (mapped === "success" || mapped === "failure" || mapped === "error") {
            update.finishedAt = status.created_at
                ? new Date(status.created_at)
                : new Date();
        }
        await deployment_model_1.DeploymentModel.updateOne({ projectId, githubDeploymentId: dep.id }, {
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
        }, { upsert: true });
    }
    static mapGithubState(state) {
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
    static async handleReleaseEvent(projectId, payload) {
        if (payload?.action !== "published")
            return;
        const release = payload?.release;
        if (!release?.id)
            return;
        await this.upsertGithubReleases(projectId, [release]);
    }
    /** Upsert published GitHub releases (webhook + backfill share this). */
    static async upsertGithubReleases(projectId, releases) {
        for (const release of releases) {
            if (!release?.id || !release.tag_name)
                continue;
            try {
                await deployment_model_1.DeploymentModel.updateOne({ projectId, githubReleaseId: release.id }, {
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
                }, { upsert: true });
            }
            catch (error) {
                if (error?.code !== 11000) {
                    logger_1.default.error("DeploymentService: release upsert failed", {
                        projectId,
                        releaseId: release.id,
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            }
        }
    }
    // ------------------------------------------------------------------
    // Manual deploy notification (API-key authenticated, for external CI)
    // ------------------------------------------------------------------
    static async recordApiDeployment(projectId, body) {
        this.validateObjectId(projectId);
        const status = body.status && ["success", "failure", "in_progress"].includes(body.status)
            ? body.status
            : "success";
        const deployment = await deployment_model_1.DeploymentModel.create({
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
    static async getDeployments(projectId, opts = {}) {
        this.validateObjectId(projectId);
        const page = Math.max(1, opts.page || 1);
        const limit = Math.min(50, Math.max(1, opts.limit || 20));
        const filter = { projectId };
        if (opts.environment)
            filter.environment = opts.environment;
        if (opts.kind === "deployment" || opts.kind === "release") {
            filter.kind = opts.kind;
        }
        const [items, total] = await Promise.all([
            deployment_model_1.DeploymentModel.find(filter)
                .sort({ startedAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
            deployment_model_1.DeploymentModel.countDocuments(filter),
        ]);
        // Lazily compute impact for eligible deployments on this page
        let computes = 0;
        for (const dep of items) {
            if (computes >= MAX_IMPACT_COMPUTES_PER_READ)
                break;
            if (this.isImpactDue(dep)) {
                try {
                    await this.computeImpact(dep);
                    computes++;
                }
                catch (error) {
                    logger_1.default.warn("DeploymentService: impact computation failed", {
                        deploymentId: String(dep._id),
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            }
        }
        return { items, meta: { page, limit, total } };
    }
    /** Deploy markers for chart overlays. */
    static async getDeployMarkers(projectId, from, to) {
        this.validateObjectId(projectId);
        const deployments = await deployment_model_1.DeploymentModel.find({
            projectId,
            startedAt: { $gte: from, $lte: to },
        })
            .select("startedAt kind environment release status impact.verdict")
            .sort({ startedAt: 1 })
            .lean();
        return deployments.map((d) => ({
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
    static isImpactDue(dep) {
        if (dep.impact?.verdict)
            return false;
        if (dep.kind !== "deployment")
            return false;
        if (dep.status !== "success")
            return false;
        const windowEnd = dep.startedAt.getTime() + IMPACT_WINDOW_MINUTES * 60 * 1000;
        return Date.now() > windowEnd;
    }
    /**
     * Compare the hour before the deploy against the hour after it.
     * Falls back to environment-unfiltered queries when the deploy
     * environment doesn't match any log environment names.
     */
    static async computeImpact(dep) {
        const windowMs = IMPACT_WINDOW_MINUTES * 60 * 1000;
        const start = dep.startedAt.getTime();
        let before = await this.aggregateWindow(dep.projectId, new Date(start - windowMs), new Date(start), dep.environment);
        let after = await this.aggregateWindow(dep.projectId, new Date(start), new Date(start + windowMs), dep.environment);
        // Environment name mismatch (e.g. GitHub env "Production — web") →
        // retry without the environment filter
        if (before.logCount === 0 && after.logCount === 0) {
            before = await this.aggregateWindow(dep.projectId, new Date(start - windowMs), new Date(start));
            after = await this.aggregateWindow(dep.projectId, new Date(start), new Date(start + windowMs));
        }
        const errorRateChangePct = before.errorRate > 0
            ? ((after.errorRate - before.errorRate) / before.errorRate) * 100
            : after.errorRate > 0
                ? 100
                : 0;
        const responseTimeChangePct = before.avgResponseTime && after.avgResponseTime
            ? ((after.avgResponseTime - before.avgResponseTime) /
                before.avgResponseTime) *
                100
            : null;
        let verdict = "unknown";
        const enoughTraffic = before.logCount >= MIN_LOGS_FOR_VERDICT &&
            after.logCount >= MIN_LOGS_FOR_VERDICT;
        if (enoughTraffic) {
            if (errorRateChangePct > VERDICT_THRESHOLD_PCT && after.errorCount >= 5) {
                verdict = "degraded";
            }
            else if (errorRateChangePct < -VERDICT_THRESHOLD_PCT &&
                before.errorCount >= 5) {
                verdict = "improved";
            }
            else {
                verdict = "healthy";
            }
        }
        else if (before.errorCount === 0 && after.errorCount >= 5) {
            // Low traffic but a clear new error burst
            verdict = "degraded";
        }
        dep.impact = {
            verdict,
            computedAt: new Date(),
            windowMinutes: IMPACT_WINDOW_MINUTES,
            before,
            after,
            errorRateChangePct: Math.round(errorRateChangePct * 10) / 10,
            responseTimeChangePct: responseTimeChangePct === null
                ? null
                : Math.round(responseTimeChangePct * 10) / 10,
        };
        await dep.save();
    }
    static async aggregateWindow(projectId, from, to, environment) {
        const match = {
            projectId,
            createdAt: { $gte: from, $lt: to },
        };
        if (environment)
            match.environment = environment;
        const [result] = await log_model_1.LogModel.aggregate([
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
            avgResponseTime: typeof result?.avgResponseTime === "number"
                ? Math.round(result.avgResponseTime)
                : null,
        };
    }
    // ------------------------------------------------------------------
    // Release health
    // ------------------------------------------------------------------
    static async getReleaseHealth(projectId, release) {
        this.validateObjectId(projectId);
        const [stats] = await log_model_1.LogModel.aggregate([
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
        const newErrorGroups = await errorGroup_model_1.ErrorGroupModel.countDocuments({
            projectId,
            releaseFirstSeen: release,
        });
        const deployments = await deployment_model_1.DeploymentModel.find({ projectId, release })
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
            deployments: deployments.map((d) => ({
                startedAt: d.startedAt,
                environment: d.environment,
                status: d.status,
            })),
        };
    }
    static validateObjectId(id) {
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            throw new Error(`Invalid ObjectId: ${id}`);
        }
    }
}
exports.DeploymentService = DeploymentService;
