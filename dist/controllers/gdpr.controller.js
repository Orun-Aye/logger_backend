"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GdprController = void 0;
const gdpr_service_1 = require("../services/gdpr.service");
const user_model_1 = require("../models/user.model");
class GdprController {
    /**
     * POST /users/data-export
     * Streams a ZIP archive of all user data to the client.
     */
    static async exportData(req, res) {
        try {
            const userId = req.userId;
            const { archive, filename } = await gdpr_service_1.GdprService.exportUserData(userId);
            res.setHeader("Content-Type", "application/zip");
            res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
            archive.pipe(res);
            archive.on("error", (err) => {
                console.error("GdprController: Archive stream error", err);
                if (!res.headersSent) {
                    res.status(500).json({
                        status: "error",
                        message: "Failed to generate data export",
                    });
                }
            });
        }
        catch (error) {
            console.error("GdprController: exportData error", error);
            res.status(500).json({
                status: "error",
                message: error instanceof Error ? error.message : "Failed to export data",
            });
        }
    }
    /**
     * POST /users/data-deletion
     * Permanently deletes the user account and all associated data.
     * Requires { confirmEmail: string } in the request body matching the user's email.
     */
    static async deleteAccount(req, res) {
        try {
            const userId = req.userId;
            const { confirmEmail } = req.body;
            if (!confirmEmail || typeof confirmEmail !== "string") {
                return res.status(400).json({
                    status: "error",
                    message: "Please provide your email address to confirm deletion",
                });
            }
            // Verify the confirmation email matches the authenticated user
            const user = await user_model_1.UserModel.findById(userId).select("email").lean();
            if (!user) {
                return res.status(404).json({
                    status: "error",
                    message: "User not found",
                });
            }
            if (user.email.toLowerCase() !== confirmEmail.toLowerCase().trim()) {
                return res.status(400).json({
                    status: "error",
                    message: "Email does not match your account email",
                });
            }
            const result = await gdpr_service_1.GdprService.deleteUserData(userId);
            return res.status(200).json({
                status: "success",
                message: "Account and all associated data have been permanently deleted",
                data: result,
            });
        }
        catch (error) {
            console.error("GdprController: deleteAccount error", error);
            return res.status(500).json({
                status: "error",
                message: error instanceof Error
                    ? error.message
                    : "Failed to delete account",
            });
        }
    }
}
exports.GdprController = GdprController;
