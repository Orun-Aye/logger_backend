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
