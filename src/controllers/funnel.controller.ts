import { Request, Response } from "express";
import { FunnelService } from "../services/funnel.service";

export class FunnelController {
  static async analyzeFunnel(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { steps, timeRange, environment } = req.body;

      const data = await FunnelService.analyzeFunnel(projectId, steps, { timeRange, environment });

      return res.status(200).json({
        status: "success",
        message: "Funnel analysis complete",
        data,
        meta: { projectId, timeRange: timeRange || "7d", stepsCount: steps.length },
      });
    } catch (error: any) {
      return res.status(500).json({ status: "error", message: error.message });
    }
  }

  static async getPopularPaths(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const timeRange = (req.query.timeRange as string) || "7d";
      const limit = parseInt(req.query.limit as string) || 10;

      const data = await FunnelService.getPopularPaths(projectId, { timeRange, limit });

      return res.status(200).json({
        status: "success",
        message: "Popular paths retrieved",
        data,
        meta: { projectId, timeRange, limit },
      });
    } catch (error: any) {
      return res.status(500).json({ status: "error", message: error.message });
    }
  }
}
