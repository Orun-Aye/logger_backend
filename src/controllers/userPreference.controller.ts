import { Request, Response } from "express";
import { UserPreferenceService } from "../services/userPreference.service";

export class UserPreferenceController {
  static async getFavorites(req: Request, res: Response) {
    try {
      const data = await UserPreferenceService.getFavoriteProjects(req.userId!);
      return res.status(200).json({ status: "success", data });
    } catch (error: any) {
      return res.status(500).json({ status: "error", message: error.message });
    }
  }

  static async addFavorite(req: Request, res: Response) {
    try {
      const { projectId } = req.body;
      const data = await UserPreferenceService.addFavorite(req.userId!, projectId);
      return res.status(200).json({ status: "success", ...data });
    } catch (error: any) {
      if (error.message === "Project not found") {
        return res.status(404).json({ status: "error", message: error.message });
      }
      return res.status(500).json({ status: "error", message: error.message });
    }
  }

  static async removeFavorite(req: Request, res: Response) {
    try {
      const { projectId } = req.body;
      const data = await UserPreferenceService.removeFavorite(req.userId!, projectId);
      return res.status(200).json({ status: "success", ...data });
    } catch (error: any) {
      return res.status(500).json({ status: "error", message: error.message });
    }
  }

  static async checkFavorite(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const isFavorite = await UserPreferenceService.isFavorite(req.userId!, projectId);
      return res.status(200).json({ status: "success", data: { isFavorite } });
    } catch (error: any) {
      return res.status(500).json({ status: "error", message: error.message });
    }
  }
}
