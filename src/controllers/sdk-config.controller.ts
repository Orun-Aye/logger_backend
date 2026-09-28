import { Request, Response } from "express";
import { SDKConfigService } from "../services/sdk-config.service";

export class SDKConfigController {
  /**
   * Get SDK config by projectId param (JWT-authenticated, dashboard use)
   */
  static async getConfig(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const config = await SDKConfigService.getOrCreateDefault(projectId);
      return res.status(200).json({
        status: "success",
        data: config,
      });
    } catch (error) {
      return res.status(500).json({
        status: "error",
        message: "Failed to fetch SDK config",
      });
    }
  }

  /**
   * Update SDK config by projectId param (JWT-authenticated, dashboard use)
   */
  static async updateConfig(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const updates = req.body;
      const config = await SDKConfigService.upsertConfig(projectId, updates);
      return res.status(200).json({
        status: "success",
        data: config,
      });
    } catch (error) {
      return res.status(500).json({
        status: "error",
        message: "Failed to update SDK config",
      });
    }
  }

  /**
   * GET /projects/:projectId/config/replay (JWT, any project member)
   */
  static async getReplaySettings(req: Request, res: Response) {
    try {
      const settings = await SDKConfigService.getReplaySettings(req.params.projectId);
      return res.status(200).json({ status: "success", data: settings });
    } catch (error) {
      return res.status(500).json({ status: "error", message: "Failed to fetch replay settings" });
    }
  }

  /**
   * PUT /projects/:projectId/config/replay (JWT, project owner or admin)
   * Body: { enabled?: boolean, sampleRate?: number between 0 and 1 }
   */
  static async updateReplaySettings(req: Request, res: Response) {
    try {
      // Turning on recording of visitors' screens is an admin decision
      const project = req.project;
      const userId = req.userId;
      const isOwner = project?.ownerId?.toString() === userId;
      const isAdmin = project?.teamMembers?.some(
        (m: any) => (m.user?._id ?? m.user)?.toString() === userId && m.role === "admin"
      );
      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          status: "error",
          message: "Only the project owner or an admin can change session replay settings",
        });
      }

      const { enabled, sampleRate } = req.body ?? {};
      if (enabled !== undefined && typeof enabled !== "boolean") {
        return res.status(400).json({ status: "error", message: "enabled must be true or false" });
      }
      if (
        sampleRate !== undefined &&
        !(typeof sampleRate === "number" && sampleRate >= 0 && sampleRate <= 1)
      ) {
        return res.status(400).json({ status: "error", message: "sampleRate must be a number from 0 to 1" });
      }

      const settings = await SDKConfigService.updateReplaySettings(req.params.projectId, {
        enabled,
        sampleRate,
      });
      return res.status(200).json({ status: "success", data: settings });
    } catch (error) {
      return res.status(500).json({ status: "error", message: "Failed to update replay settings" });
    }
  }

  /**
   * Get SDK config via API key (SDK remote config use)
   * projectId is resolved from API key by authenticateApiKey middleware
   */
  static async getConfigByApiKey(req: Request, res: Response) {
    try {
      const projectId = req.projectId;
      if (!projectId) {
        return res.status(400).json({
          status: "error",
          message: "Project ID not resolved from API key",
        });
      }

      const config = await SDKConfigService.getOrCreateDefault(projectId);

      // The SDK asks on every page load; let the browser reuse the answer.
      // Dashboard changes therefore reach visitors within 5 minutes.
      res.set("Cache-Control", "private, max-age=300");

      // Return only SDK-relevant fields (exclude internal metadata)
      return res.status(200).json({
        status: "success",
        data: {
          minLogLevel: config.minLogLevel,
          batchSize: config.batchSize,
          flushIntervalMs: config.flushIntervalMs,
          environment: config.environment,
          serviceName: config.serviceName,
          autoCapture: config.autoCapture,
          sanitization: {
            enabled: config.sanitization?.enabled,
            preset: config.sanitization?.strictMode,
          },
          replay: {
            enabled: config.replay?.enabled ?? false,
            sampleRate: config.replay?.sampleRate ?? 0.1,
          },
        },
      });
    } catch (error) {
      return res.status(500).json({
        status: "error",
        message: "Failed to fetch SDK config",
      });
    }
  }
}
