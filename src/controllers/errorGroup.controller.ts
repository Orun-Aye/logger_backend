import { Request, Response } from "express";
import { ErrorGroupService } from "../services/errorGroup.service";
import logger from "../utils/logger";

function ok<T>(res: Response, data: T, meta?: any) {
  return res.json({ status: "success", data, ...(meta ? { meta } : {}) });
}

function fail(res: Response, status: number, message: string) {
  return res.status(status).json({ status: "error", message });
}

function mapError(res: Response, err: unknown, context: string) {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("not found")) return fail(res, 404, message);
  if (message.includes("Invalid ObjectId")) return fail(res, 400, message);
  if (message.includes("No GitHub")) return fail(res, 409, message);
  logger.error(`ErrorGroupController.${context} failed`, { message });
  return fail(res, 500, message);
}

export const ErrorGroupController = {
  /** GET /projects/:projectId/error-groups */
  async list(req: Request, res: Response) {
    const { projectId } = req.params;
    try {
      const sort = ["lastSeen", "count", "firstSeen", "sessionCount"].includes(
        String(req.query.sort)
      )
        ? (String(req.query.sort) as "lastSeen" | "count" | "firstSeen" | "sessionCount")
        : undefined;

      const result = await ErrorGroupService.getGroups(projectId, {
        page: parseInt(String(req.query.page || "1"), 10) || 1,
        limit: parseInt(String(req.query.limit || "20"), 10) || 20,
        status:
          typeof req.query.status === "string" ? req.query.status : undefined,
        environment:
          typeof req.query.environment === "string"
            ? req.query.environment
            : undefined,
        search:
          typeof req.query.search === "string" ? req.query.search : undefined,
        sort,
      });
      return res.json({
        status: "success",
        data: result.items,
        meta: { ...result.meta, stats: result.stats },
      });
    } catch (err) {
      return mapError(res, err, "list");
    }
  },

  /** GET /projects/:projectId/error-groups/:groupId */
  async detail(req: Request, res: Response) {
    const { projectId, groupId } = req.params;
    try {
      const result = await ErrorGroupService.getGroupDetail(projectId, groupId);
      return ok(res, result);
    } catch (err) {
      return mapError(res, err, "detail");
    }
  },

  /** PATCH /projects/:projectId/error-groups/:groupId — status changes. */
  async updateStatus(req: Request, res: Response) {
    const { projectId, groupId } = req.params;
    const { status } = req.body || {};
    if (!["unresolved", "resolved", "ignored"].includes(status)) {
      return fail(res, 400, "status must be unresolved, resolved, or ignored");
    }
    try {
      const group = await ErrorGroupService.updateStatus(
        projectId,
        groupId,
        status,
        req.userId
      );
      return ok(res, group);
    } catch (err) {
      return mapError(res, err, "updateStatus");
    }
  },

  /** GET /projects/:projectId/error-groups/:groupId/issue-draft — AI prefill, no side effects. */
  async issueDraft(req: Request, res: Response) {
    const { projectId, groupId } = req.params;
    try {
      const draft = await ErrorGroupService.getIssueDraft(projectId, groupId);
      return ok(res, draft);
    } catch (err) {
      return mapError(res, err, "issueDraft");
    }
  },

  /** POST /projects/:projectId/error-groups/:groupId/create-issue */
  async createIssue(req: Request, res: Response) {
    const { projectId, groupId } = req.params;
    const { title, body, labels } = req.body || {};
    try {
      const result = await ErrorGroupService.createIssue(projectId, groupId, {
        title: typeof title === "string" && title.trim() ? title.trim() : undefined,
        body: typeof body === "string" && body.trim() ? body : undefined,
        labels: Array.isArray(labels) ? labels.filter((l) => typeof l === "string") : undefined,
        userId: req.userId,
      });
      return res
        .status(result.alreadyLinked ? 200 : 201)
        .json({ status: "success", data: result });
    } catch (err) {
      return mapError(res, err, "createIssue");
    }
  },
};
