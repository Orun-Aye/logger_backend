import { Request, Response } from "express";
import { AIInsightsService } from "../services/ai-insights.service";
import { askQuestionSchema, enrichedInsightsQuerySchema } from "../validators/ai-insights.validator";
import { config } from "../config";

export class AIInsightsController {
  /**
   * GET /insights/:projectId/root-cause/:errorId
   */
  static async getRootCause(req: Request, res: Response) {
    try {
      const { projectId, errorId } = req.params;

      const data = await AIInsightsService.getRootCause(projectId, errorId);

      return res.status(200).json({
        status: "success",
        message: "Root cause analysis complete",
        data,
        meta: { projectId, errorId },
      });
    } catch (error: any) {
      return res.status(500).json({ status: "error", message: error.message });
    }
  }

  /**
   * POST /insights/:projectId/ask
   */
  static async askQuestion(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const parsed = askQuestionSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          status: "error",
          message: "Invalid request body",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const data = await AIInsightsService.askQuestion(projectId, parsed.data.question);

      return res.status(200).json({
        status: "success",
        message: "Question answered",
        data,
        meta: { projectId },
      });
    } catch (error: any) {
      return res.status(500).json({ status: "error", message: error.message });
    }
  }

  /**
   * GET /insights/:projectId/suggestions
   */
  static async getOptimizationSuggestions(req: Request, res: Response) {
    try {
      const { projectId } = req.params;

      const data = await AIInsightsService.getOptimizationSuggestions(projectId);

      return res.status(200).json({
        status: "success",
        message: "Optimization suggestions generated",
        data: data.suggestions,
        meta: { projectId },
      });
    } catch (error: any) {
      return res.status(500).json({ status: "error", message: error.message });
    }
  }

  /**
   * GET /insights/:projectId/enriched
   */
  static async getEnrichedInsights(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const parsed = enrichedInsightsQuerySchema.safeParse(req.query);

      const timeRange = parsed.success ? parsed.data.timeRange : undefined;

      const data = await AIInsightsService.getEnrichedInsights(projectId, {
        timeRange,
      });

      return res.status(200).json({
        status: "success",
        message: "Enriched insights generated",
        data,
        meta: { projectId },
      });
    } catch (error: any) {
      return res.status(500).json({ status: "error", message: error.message });
    }
  }
}
