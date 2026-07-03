"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangeController = void 0;
const change_service_1 = require("../services/change.service");
const deployment_service_1 = require("../services/deployment.service");
const logger_1 = __importDefault(require("../utils/logger"));
function ok(res, data, meta) {
    return res.json({ status: "success", data, ...(meta ? { meta } : {}) });
}
function fail(res, status, message) {
    return res.status(status).json({ status: "error", message });
}
function parseDate(value) {
    if (typeof value !== "string")
        return undefined;
    const d = new Date(value);
    return isNaN(d.getTime()) ? undefined : d;
}
exports.ChangeController = {
    /** GET /projects/:projectId/changes — unified feed (commits + deploys + releases). */
    async getChanges(req, res) {
        const { projectId } = req.params;
        try {
            const type = ["commit", "deployment", "release"].includes(String(req.query.type))
                ? String(req.query.type)
                : undefined;
            const result = await change_service_1.ChangeService.getChanges(projectId, {
                page: parseInt(String(req.query.page || "1"), 10) || 1,
                limit: parseInt(String(req.query.limit || "20"), 10) || 20,
                type,
                author: typeof req.query.author === "string" ? req.query.author : undefined,
                from: parseDate(req.query.from),
                to: parseDate(req.query.to),
            });
            return ok(res, result.items, result.meta);
        }
        catch (err) {
            const message = err.message;
            if (message.includes("Invalid ObjectId"))
                return fail(res, 400, message);
            logger_1.default.error("ChangeController.getChanges failed", { projectId, message });
            return fail(res, 500, message);
        }
    },
    /** POST /projects/:projectId/changes/:sha/explain — deeper AI explanation. */
    async explainChange(req, res) {
        const { projectId, sha } = req.params;
        try {
            const result = await change_service_1.ChangeService.explainChange(projectId, sha);
            return ok(res, result);
        }
        catch (err) {
            const message = err.message;
            if (message.includes("not found"))
                return fail(res, 404, message);
            if (message.includes("No GitHub repo"))
                return fail(res, 404, message);
            if (message.includes("Invalid ObjectId"))
                return fail(res, 400, message);
            logger_1.default.error("ChangeController.explainChange failed", { projectId, sha, message });
            return fail(res, 500, message);
        }
    },
    /** POST /projects/:projectId/changes/retry-summaries — re-run failed AI summaries. */
    async retrySummaries(req, res) {
        const { projectId } = req.params;
        const shas = Array.isArray(req.body?.shas) ? req.body.shas : [];
        if (shas.length === 0 || shas.length > 20) {
            return fail(res, 400, "Provide 1-20 commit shas");
        }
        try {
            await change_service_1.ChangeService.retrySummaries(projectId, shas);
            return ok(res, { queued: shas.length });
        }
        catch (err) {
            return fail(res, 500, err.message);
        }
    },
    /** POST /projects/:projectId/changes/backfill — manual re-import of recent commits. */
    async backfill(req, res) {
        const { projectId } = req.params;
        try {
            // Fire-and-forget; the feed fills in as the import progresses
            void change_service_1.ChangeService.backfillProject(projectId);
            return res
                .status(202)
                .json({ status: "success", data: { queued: true } });
        }
        catch (err) {
            return fail(res, 500, err.message);
        }
    },
    // ------------------------------------------------------------------
    // Deployments & releases
    // ------------------------------------------------------------------
    /** GET /projects/:projectId/deployments */
    async getDeployments(req, res) {
        const { projectId } = req.params;
        try {
            const result = await deployment_service_1.DeploymentService.getDeployments(projectId, {
                page: parseInt(String(req.query.page || "1"), 10) || 1,
                limit: parseInt(String(req.query.limit || "20"), 10) || 20,
                environment: typeof req.query.environment === "string"
                    ? req.query.environment
                    : undefined,
                kind: typeof req.query.kind === "string" ? req.query.kind : undefined,
            });
            return ok(res, result.items, result.meta);
        }
        catch (err) {
            const message = err.message;
            if (message.includes("Invalid ObjectId"))
                return fail(res, 400, message);
            return fail(res, 500, message);
        }
    },
    /** GET /projects/:projectId/deploy-markers?from=&to= — chart overlay data. */
    async getDeployMarkers(req, res) {
        const { projectId } = req.params;
        const from = parseDate(req.query.from);
        const to = parseDate(req.query.to);
        if (!from || !to) {
            return fail(res, 400, "from and to (ISO dates) are required");
        }
        try {
            const markers = await deployment_service_1.DeploymentService.getDeployMarkers(projectId, from, to);
            return ok(res, markers);
        }
        catch (err) {
            const message = err.message;
            if (message.includes("Invalid ObjectId"))
                return fail(res, 400, message);
            return fail(res, 500, message);
        }
    },
    /** GET /projects/:projectId/releases/:release/health */
    async getReleaseHealth(req, res) {
        const { projectId, release } = req.params;
        try {
            const health = await deployment_service_1.DeploymentService.getReleaseHealth(projectId, decodeURIComponent(release));
            return ok(res, health);
        }
        catch (err) {
            const message = err.message;
            if (message.includes("Invalid ObjectId"))
                return fail(res, 400, message);
            return fail(res, 500, message);
        }
    },
    /**
     * POST /projects/:projectId/deployments — manual deploy notification.
     * API-key authenticated (CI systems outside GitHub Deployments).
     */
    async recordDeployment(req, res) {
        const { projectId } = req.params;
        try {
            const deployment = await deployment_service_1.DeploymentService.recordApiDeployment(projectId, req.body || {});
            return res.status(201).json({ status: "success", data: deployment });
        }
        catch (err) {
            const message = err.message;
            if (message.includes("Invalid ObjectId"))
                return fail(res, 400, message);
            return fail(res, 500, message);
        }
    },
};
