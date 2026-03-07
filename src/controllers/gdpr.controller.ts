import { Request, Response } from "express";
import { GdprService } from "../services/gdpr.service";
import { UserModel } from "../models/user.model";

interface ApiResponse<T = any> {
  status: "success" | "error";
  message?: string;
  data?: T;
  errors?: string[];
}

export class GdprController {
  /**
   * POST /users/data-export
   * Streams a ZIP archive of all user data to the client.
   */
  static async exportData(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.userId!;

      const { archive, filename } = await GdprService.exportUserData(userId);

      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );

      archive.pipe(res);

      archive.on("error", (err: Error) => {
        console.error("GdprController: Archive stream error", err);
        if (!res.headersSent) {
          res.status(500).json({
            status: "error",
            message: "Failed to generate data export",
          } as ApiResponse);
        }
      });
    } catch (error) {
      console.error("GdprController: exportData error", error);
      res.status(500).json({
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to export data",
      } as ApiResponse);
    }
  }

  /**
   * POST /users/data-deletion
   * Permanently deletes the user account and all associated data.
   * Requires { confirmEmail: string } in the request body matching the user's email.
   */
  static async deleteAccount(req: Request, res: Response): Promise<Response> {
    try {
      const userId = req.userId!;
      const { confirmEmail } = req.body;

      if (!confirmEmail || typeof confirmEmail !== "string") {
        return res.status(400).json({
          status: "error",
          message: "Please provide your email address to confirm deletion",
        } as ApiResponse);
      }

      // Verify the confirmation email matches the authenticated user
      const user = await UserModel.findById(userId).select("email").lean();
      if (!user) {
        return res.status(404).json({
          status: "error",
          message: "User not found",
        } as ApiResponse);
      }

      if (user.email.toLowerCase() !== confirmEmail.toLowerCase().trim()) {
        return res.status(400).json({
          status: "error",
          message: "Email does not match your account email",
        } as ApiResponse);
      }

      const result = await GdprService.deleteUserData(userId);

      return res.status(200).json({
        status: "success",
        message: "Account and all associated data have been permanently deleted",
        data: result,
      } as ApiResponse);
    } catch (error) {
      console.error("GdprController: deleteAccount error", error);
      return res.status(500).json({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to delete account",
      } as ApiResponse);
    }
  }
}
