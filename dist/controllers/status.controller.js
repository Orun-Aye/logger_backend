"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusController = void 0;
const status_service_1 = require("../services/status.service");
class StatusController {
    /**
     * GET /api/v1/public/status
     * Returns system status with component health, incidents, and uptime.
     * No authentication required.
     */
    static async getSystemStatus(req, res) {
        try {
            const status = await status_service_1.StatusService.getSystemStatus();
            res.status(200).json({
                status: "success",
                data: status,
            });
        }
        catch (error) {
            console.error("StatusController Error:", error);
            res.status(500).json({
                status: "error",
                message: "Failed to retrieve system status",
            });
        }
    }
}
exports.StatusController = StatusController;
