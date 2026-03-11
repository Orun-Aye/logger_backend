"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnomalyController = void 0;
const anomaly_service_1 = require("../services/anomaly.service");
const anomaly_validator_1 = require("../validators/anomaly.validator");
class AnomalyController {
    static async getAnomalies(req, res) {
        try {
            const { projectId } = req.params;
            const parsed = anomaly_validator_1.getAnomaliesQuerySchema.safeParse(req.query);
            if (!parsed.success) {
                return res.status(400).json({
                    status: "error",
                    message: "Invalid query parameters",
                    errors: parsed.error.flatten().fieldErrors,
                });
            }
            const data = await anomaly_service_1.AnomalyService.getAnomalies(projectId, parsed.data);
            return res.status(200).json({
                status: "success",
                message: "Anomalies retrieved",
                data: data.anomalies,
                meta: {
                    projectId,
                    total: data.total,
                    limit: data.limit,
                    offset: data.offset,
                },
            });
        }
        catch (error) {
            return res.status(500).json({ status: "error", message: error.message });
        }
    }
    static async getAnomalyStats(req, res) {
        try {
            const { projectId } = req.params;
            const data = await anomaly_service_1.AnomalyService.getAnomalyStats(projectId);
            return res.status(200).json({
                status: "success",
                message: "Anomaly stats retrieved",
                data,
                meta: { projectId },
            });
        }
        catch (error) {
            return res.status(500).json({ status: "error", message: error.message });
        }
    }
    static async acknowledgeAnomaly(req, res) {
        try {
            const { anomalyId } = req.params;
            const userId = req.userId;
            if (!userId) {
                return res.status(401).json({ status: "error", message: "Unauthorized" });
            }
            const data = await anomaly_service_1.AnomalyService.acknowledgeAnomaly(anomalyId, userId);
            return res.status(200).json({
                status: "success",
                message: "Anomaly acknowledged",
                data,
            });
        }
        catch (error) {
            const status = error.message === "Anomaly not found" ? 404 : 500;
            return res.status(status).json({ status: "error", message: error.message });
        }
    }
    static async resolveAnomaly(req, res) {
        try {
            const { anomalyId } = req.params;
            const data = await anomaly_service_1.AnomalyService.resolveAnomaly(anomalyId);
            return res.status(200).json({
                status: "success",
                message: "Anomaly resolved",
                data,
            });
        }
        catch (error) {
            const status = error.message === "Anomaly not found" ? 404 : 500;
            return res.status(status).json({ status: "error", message: error.message });
        }
    }
    static async scanNow(req, res) {
        try {
            const { projectId } = req.params;
            const detected = await anomaly_service_1.AnomalyService.scanProject(projectId);
            return res.status(200).json({
                status: "success",
                message: `Anomaly scan complete: ${detected} anomalies detected`,
                data: { detected },
                meta: { projectId },
            });
        }
        catch (error) {
            return res.status(500).json({ status: "error", message: error.message });
        }
    }
}
exports.AnomalyController = AnomalyController;
