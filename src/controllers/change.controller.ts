import { Request, Response } from "express";
import { ChangeService } from "../services/change.service";
import { DeploymentService } from "../services/deployment.service";
import logger from "../utils/logger";

function ok<T>(res: Response, data: T, meta?: any) {
  return res.json({ status: "success", data, ...(meta ? { meta } : {}) });
}

function fail(res: Response, status: number, message: string) {
  return res.status(status).json({ status: "error", message });
}

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== "string") return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

export const ChangeController = {
  /** GET /projects/:projectId/changes — unified feed (commits + deploys + releases). */
  async getChanges(req: Request, res: Response) {
    const { projectId } = req.params;
    try {
      const type = ["commit", "deployment", "release"].includes(
        String(req.query.type)
      )
        ? (String(req.query.type) as "commit" | "deployment" | "release")
        : undefined;

      const result = await ChangeService.getChanges(projectId, {
        page: parseInt(String(req.query.page || "1"), 10) || 1,
        limit: parseInt(String(req.query.limit || "20"), 10) || 20,
        type,
        author:
          typeof req.query.author === "string" ? req.query.author : undefined,
        from: parseDate(req.query.from),
        to: parseDate(req.query.to),
      });
      return ok(res, result.items, result.meta);
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes("Invalid ObjectId")) return fail(res, 400, message);
      logger.error("ChangeController.getChanges failed", { projectId, message });
      return fail(res, 500, message);
    }
  },

  /** POST /projects/:projectId/changes/:sha/explain — deeper AI explanation. */
  async explainChange(req: Request, res: Response) {
    const { projectId, sha } = req.params;
    try {
      const result = await ChangeService.explainChange(projectId, sha);
      return ok(res, result);
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes("not found")) return fail(res, 404, message);
      if (message.includes("No GitHub repo")) return fail(res, 404, message);
      if (message.includes("Invalid ObjectId")) return fail(res, 400, message);
      logger.error("ChangeController.explainChange failed", { projectId, sha, message });
      return fail(res, 500, message);
    }
  },

  /** POST /projects/:projectId/changes/retry-summaries — re-run failed AI summaries. */
  async retrySummaries(req: Request, res: Response) {
    const { projectId } = req.params;
    const shas: string[] = Array.isArray(req.body?.shas) ? req.body.shas : [];
    if (shas.length === 0 || shas.length > 20) {
      return fail(res, 400, "Provide 1-20 commit shas");
    }
    try {
      await ChangeService.retrySummaries(projectId, shas);
      return ok(res, { queued: shas.length });
    } catch (err) {
      return fail(res, 500, (err as Error).message);
    }
  },

  /** POST /projects/:projectId/changes/backfill — manual re-import of recent commits, releases and deployments. */
  async backfill(req: Request, res: Response) {
    const { projectId } = req.params;
    try {
      // Without a linked repo the backfill returns immediately, so reporting
      // "queued" would be a lie the UI shows as success.
      if (!(await ChangeService.hasLinkedRepo(projectId))) {
        return fail(res, 409, "No GitHub repository is linked to this project");
      }
      // Fire-and-forget; the feed fills in as the import progresses
      void ChangeService.backfillProject(projectId);
      return res
        .status(202)
        .json({ status: "success", data: { queued: true } });
    } catch (err) {
      return fail(res, 500, (err as Error).message);
    }
  },

  // ------------------------------------------------------------------
  // Deployments & releases
  // ------------------------------------------------------------------

  /** GET /projects/:projectId/deployments */
  async getDeployments(req: Request, res: Response) {
    const { projectId } = req.params;
    try {
      const result = await DeploymentService.getDeployments(projectId, {
        page: parseInt(String(req.query.page || "1"), 10) || 1,
        limit: parseInt(String(req.query.limit || "20"), 10) || 20,
        environment:
          typeof req.query.environment === "string"
            ? req.query.environment
            : undefined,
        kind: typeof req.query.kind === "string" ? req.query.kind : undefined,
      });
      return ok(res, result.items, result.meta);
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes("Invalid ObjectId")) return fail(res, 400, message);
      return fail(res, 500, message);
    }
  },

  /** GET /projects/:projectId/deploy-markers?from=&to= — chart overlay data. */
  async getDeployMarkers(req: Request, res: Response) {
    const { projectId } = req.params;
    const from = parseDate(req.query.from);
    const to = parseDate(req.query.to);
    if (!from || !to) {
      return fail(res, 400, "from and to (ISO dates) are required");
    }
    try {
      const markers = await DeploymentService.getDeployMarkers(
        projectId,
        from,
        to
      );
      return ok(res, markers);
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes("Invalid ObjectId")) return fail(res, 400, message);
      return fail(res, 500, message);
    }
  },

  /** GET /projects/:projectId/releases/:release/health */
  async getReleaseHealth(req: Request, res: Response) {
    const { projectId, release } = req.params;
    try {
      const health = await DeploymentService.getReleaseHealth(
        projectId,
        decodeURIComponent(release)
      );
      return ok(res, health);
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes("Invalid ObjectId")) return fail(res, 400, message);
      return fail(res, 500, message);
    }
  },

  /**
   * POST /projects/:projectId/deployments — manual deploy notification.
   * API-key authenticated (CI systems outside GitHub Deployments).
   */
  async recordDeployment(req: Request, res: Response) {
    const { projectId } = req.params;
    // The API key identifies one project; it may only record deploys for that one
    if (req.projectId !== projectId) {
      return fail(res, 403, "API key does not belong to this project");
    }
    try {
      const deployment = await DeploymentService.recordApiDeployment(
        projectId,
        req.body || {}
      );
      return res.status(201).json({ status: "success", data: deployment });
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes("Invalid ObjectId")) return fail(res, 400, message);
      return fail(res, 500, message);
    }
  },
};
