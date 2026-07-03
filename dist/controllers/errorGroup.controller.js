"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorGroupController = void 0;
const errorGroup_service_1 = require("../services/errorGroup.service");
const logger_1 = __importDefault(require("../utils/logger"));
function ok(res, data, meta) {
    return res.json({ status: "success", data, ...(meta ? { meta } : {}) });
}
function fail(res, status, message) {
    return res.status(status).json({ status: "error", message });
}
function mapError(res, err, context) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("not found"))
        return fail(res, 404, message);
    if (message.includes("Invalid ObjectId"))
        return fail(res, 400, message);
    if (message.includes("No GitHub"))
        return fail(res, 409, message);
    logger_1.default.error(`ErrorGroupController.${context} failed`, { message });
    return fail(res, 500, message);
}
exports.ErrorGroupController = {
    /** GET /projects/:projectId/error-groups */
    async list(req, res) {
        const { projectId } = req.params;
        try {
            const sort = ["lastSeen", "count", "firstSeen", "sessionCount"].includes(String(req.query.sort))
                ? String(req.query.sort)
                : undefined;
            const result = await errorGroup_service_1.ErrorGroupService.getGroups(projectId, {
                page: parseInt(String(req.query.page || "1"), 10) || 1,
                limit: parseInt(String(req.query.limit || "20"), 10) || 20,
                status: typeof req.query.status === "string" ? req.query.status : undefined,
                environment: typeof req.query.environment === "string"
                    ? req.query.environment
                    : undefined,
                search: typeof req.query.search === "string" ? req.query.search : undefined,
                sort,
            });
            return res.json({
                status: "success",
                data: result.items,
                meta: { ...result.meta, stats: result.stats },
            });
        }
        catch (err) {
            return mapError(res, err, "list");
        }
    },
    /** GET /projects/:projectId/error-groups/:groupId */
    async detail(req, res) {
        const { projectId, groupId } = req.params;
        try {
            const result = await errorGroup_service_1.ErrorGroupService.getGroupDetail(projectId, groupId);
            return ok(res, result);
        }
        catch (err) {
            return mapError(res, err, "detail");
        }
    },
    /** PATCH /projects/:projectId/error-groups/:groupId — status changes. */
    async updateStatus(req, res) {
        const { projectId, groupId } = req.params;
        const { status } = req.body || {};
        if (!["unresolved", "resolved", "ignored"].includes(status)) {
            return fail(res, 400, "status must be unresolved, resolved, or ignored");
        }
        try {
            const group = await errorGroup_service_1.ErrorGroupService.updateStatus(projectId, groupId, status, req.userId);
            return ok(res, group);
        }
        catch (err) {
            return mapError(res, err, "updateStatus");
        }
    },
    /** GET /projects/:projectId/error-groups/:groupId/issue-draft — AI prefill, no side effects. */
    async issueDraft(req, res) {
        const { projectId, groupId } = req.params;
        try {
            const draft = await errorGroup_service_1.ErrorGroupService.getIssueDraft(projectId, groupId);
            return ok(res, draft);
        }
        catch (err) {
            return mapError(res, err, "issueDraft");
        }
    },
    /** POST /projects/:projectId/error-groups/:groupId/create-issue */
    async createIssue(req, res) {
        const { projectId, groupId } = req.params;
        const { title, body, labels } = req.body || {};
        try {
            const result = await errorGroup_service_1.ErrorGroupService.createIssue(projectId, groupId, {
                title: typeof title === "string" && title.trim() ? title.trim() : undefined,
                body: typeof body === "string" && body.trim() ? body : undefined,
                labels: Array.isArray(labels) ? labels.filter((l) => typeof l === "string") : undefined,
                userId: req.userId,
            });
            return res
                .status(result.alreadyLinked ? 200 : 201)
                .json({ status: "success", data: result });
        }
        catch (err) {
            return mapError(res, err, "createIssue");
        }
    },
};
