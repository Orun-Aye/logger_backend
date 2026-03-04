import { Request, Response } from "express";
import { RegressionService } from "../services/regression.service";

export class RegressionController {
  static async detectRegressions(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { currentPeriod, baselinePeriod, threshold, metrics } = req.query;

      const data = await RegressionService.detectRegressions(projectId, {
        currentPeriod: currentPeriod as string,
        baselinePeriod: baselinePeriod as string,
        threshold: threshold ? Number(threshold) : undefined,
        metrics: metrics ? (metrics as string).split(",") : undefined,
      });

      return res.status(200).json({
        status: "success",
        message: "Regression analysis complete",
        data,
        meta: { projectId, currentPeriod: currentPeriod || "24h", baselinePeriod: baselinePeriod || "7d" },
      });
    } catch (error: any) {
      return res.status(500).json({ status: "error", message: error.message });
    }
  }

  static async getBaseline(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const period = (req.query.period as string) || "7d";

      const data = await RegressionService.getBaseline(projectId, { period });

      return res.status(200).json({
        status: "success",
        message: "Baseline metrics retrieved",
        data,
        meta: { projectId, period },
      });
    } catch (error: any) {
      return res.status(500).json({ status: "error", message: error.message });
    }
  }

  static async comparePerformance(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { currentPeriod, baselinePeriod, metrics } = req.body;

      const data = await RegressionService.comparePerformance(projectId, {
        currentPeriod,
        baselinePeriod,
        metrics,
      });

      return res.status(200).json({
        status: "success",
        message: "Performance comparison complete",
        data,
        meta: { projectId, currentPeriod, baselinePeriod },
      });
    } catch (error: any) {
      return res.status(500).json({ status: "error", message: error.message });
    }
  }
}
