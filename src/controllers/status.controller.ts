import { Request, Response } from "express";
import { StatusService } from "../services/status.service";

export class StatusController {
  /**
   * GET /api/v1/public/status
   * Returns system status with component health, incidents, and uptime.
   * No authentication required.
   */
  static async getSystemStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = await StatusService.getSystemStatus();

      res.status(200).json({
        status: "success",
        data: status,
      });
    } catch (error) {
      console.error("StatusController Error:", error);
      res.status(500).json({
        status: "error",
        message: "Failed to retrieve system status",
      });
    }
  }
}
