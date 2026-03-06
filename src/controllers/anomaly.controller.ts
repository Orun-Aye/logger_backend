import { Request, Response } from "express";
import { AnomalyService } from "../services/anomaly.service";
import { getAnomaliesQuerySchema } from "../validators/anomaly.validator";

export class AnomalyController {
  static async getAnomalies(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const parsed = getAnomaliesQuerySchema.safeParse(req.query);

      if (!parsed.success) {
        return res.status(400).json({
          status: "error",
          message: "Invalid query parameters",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const data = await AnomalyService.getAnomalies(projectId, parsed.data);

      return res.status(200).json({
        status: "success",
        message: "Anomalies retrieved",
        data: data.anomalies,
        meta: {
          projectId,
          total: data.total,
          limit: data.limit,
          offset: data.offset,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ status: "error", message: error.message });
    }
  }

  static async getAnomalyStats(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const data = await AnomalyService.getAnomalyStats(projectId);

      return res.status(200).json({
        status: "success",
        message: "Anomaly stats retrieved",
        data,
        meta: { projectId },
      });
    } catch (error: any) {
      return res.status(500).json({ status: "error", message: error.message });
    }
  }

  static async acknowledgeAnomaly(req: Request, res: Response) {
    try {
      const { anomalyId } = req.params;
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({ status: "error", message: "Unauthorized" });
      }

      const data = await AnomalyService.acknowledgeAnomaly(anomalyId, userId);

      return res.status(200).json({
        status: "success",
        message: "Anomaly acknowledged",
        data,
      });
    } catch (error: any) {
      const status = error.message === "Anomaly not found" ? 404 : 500;
      return res.status(status).json({ status: "error", message: error.message });
    }
  }

  static async resolveAnomaly(req: Request, res: Response) {
    try {
      const { anomalyId } = req.params;
      const data = await AnomalyService.resolveAnomaly(anomalyId);

      return res.status(200).json({
        status: "success",
        message: "Anomaly resolved",
        data,
      });
    } catch (error: any) {
      const status = error.message === "Anomaly not found" ? 404 : 500;
      return res.status(status).json({ status: "error", message: error.message });
    }
  }

  static async scanNow(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const detected = await AnomalyService.scanProject(projectId);

      return res.status(200).json({
        status: "success",
        message: `Anomaly scan complete: ${detected} anomalies detected`,
        data: { detected },
        meta: { projectId },
      });
    } catch (error: any) {
      return res.status(500).json({ status: "error", message: error.message });
    }
  }
}
