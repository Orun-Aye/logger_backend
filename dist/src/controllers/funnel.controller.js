"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FunnelController = void 0;
const funnel_service_1 = require("../services/funnel.service");
class FunnelController {
    static async analyzeFunnel(req, res) {
        try {
            const { projectId } = req.params;
            const { steps, timeRange, environment } = req.body;
            const data = await funnel_service_1.FunnelService.analyzeFunnel(projectId, steps, { timeRange, environment });
            return res.status(200).json({
                status: "success",
                message: "Funnel analysis complete",
                data,
                meta: { projectId, timeRange: timeRange || "7d", stepsCount: steps.length },
            });
        }
        catch (error) {
            return res.status(500).json({ status: "error", message: error.message });
        }
    }
    static async getPopularPaths(req, res) {
        try {
            const { projectId } = req.params;
            const timeRange = req.query.timeRange || "7d";
            const limit = parseInt(req.query.limit) || 10;
            const data = await funnel_service_1.FunnelService.getPopularPaths(projectId, { timeRange, limit });
            return res.status(200).json({
                status: "success",
                message: "Popular paths retrieved",
                data,
                meta: { projectId, timeRange, limit },
            });
        }
        catch (error) {
            return res.status(500).json({ status: "error", message: error.message });
        }
    }
}
exports.FunnelController = FunnelController;
