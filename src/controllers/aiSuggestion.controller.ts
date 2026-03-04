import { Request, Response } from "express";
import { AISuggestionService } from "../services/aiSuggestion.service";

export class AISuggestionController {
  static async getSuggestions(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;

      const data = await AISuggestionService.suggestAlertRules(projectId, { limit });

      return res.status(200).json({
        status: "success",
        message: "Alert rule suggestions generated",
        data,
        meta: { projectId, count: data.length, method: "rule-based" },
      });
    } catch (error: any) {
      return res.status(500).json({ status: "error", message: error.message });
    }
  }

  static async acceptSuggestion(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const data = await AISuggestionService.acceptSuggestion(projectId, req.userId!, req.body);

      return res.status(201).json({
        status: "success",
        message: "Alert rule created from suggestion",
        data,
      });
    } catch (error: any) {
      return res.status(500).json({ status: "error", message: error.message });
    }
  }
}
