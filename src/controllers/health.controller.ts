// src/controllers/health.controller.ts

import { Request, Response } from "express";
import { HealthService } from "../services/health.service";

/**
 * Health check controller
 * Provides endpoints for health, readiness, and liveness probes
 */
export class HealthController {
  /**
   * Comprehensive health check with component status
   * GET /api/v1/health
   */
  static async health(req: Request, res: Response): Promise<Response> {
    try {
      const healthStatus = await HealthService.getHealthStatus();

      const statusCode = healthStatus.status === "healthy" ? 200 : 503;

      return res.status(statusCode).json({
        status: healthStatus.status === "healthy" ? "success" : "error",
        data: healthStatus,
      });
    } catch (error) {
      return res.status(503).json({
        status: "error",
        message: "Health check failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Readiness probe - checks if service can accept traffic
   * GET /api/v1/ready
   */
  static async ready(req: Request, res: Response): Promise<Response> {
    try {
      const isReady = await HealthService.checkReadiness();

      if (isReady) {
        return res.status(200).json({
          status: "success",
          message: "Service is ready",
        });
      } else {
        return res.status(503).json({
          status: "error",
          message: "Service is not ready",
        });
      }
    } catch (error) {
      return res.status(503).json({
        status: "error",
        message: "Readiness check failed",
      });
    }
  }

  /**
   * Liveness probe - checks if service is alive
   * GET /api/v1/live
   */
  static live(req: Request, res: Response): Response {
    const isAlive = HealthService.checkLiveness();

    if (isAlive) {
      return res.status(200).json({
        status: "success",
        message: "Service is alive",
      });
    } else {
      return res.status(503).json({
        status: "error",
        message: "Service is not alive",
      });
    }
  }
}
