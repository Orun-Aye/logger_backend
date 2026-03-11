"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegressionController = void 0;
const regression_service_1 = require("../services/regression.service");
class RegressionController {
    static async detectRegressions(req, res) {
        try {
            const { projectId } = req.params;
            const { currentPeriod, baselinePeriod, threshold, metrics } = req.query;
            const data = await regression_service_1.RegressionService.detectRegressions(projectId, {
                currentPeriod: currentPeriod,
                baselinePeriod: baselinePeriod,
                threshold: threshold ? Number(threshold) : undefined,
                metrics: metrics ? metrics.split(",") : undefined,
            });
            return res.status(200).json({
                status: "success",
                message: "Regression analysis complete",
                data,
                meta: { projectId, currentPeriod: currentPeriod || "24h", baselinePeriod: baselinePeriod || "7d" },
            });
        }
        catch (error) {
            return res.status(500).json({ status: "error", message: error.message });
        }
    }
    static async getBaseline(req, res) {
        try {
            const { projectId } = req.params;
            const period = req.query.period || "7d";
            const data = await regression_service_1.RegressionService.getBaseline(projectId, { period });
            return res.status(200).json({
                status: "success",
                message: "Baseline metrics retrieved",
                data,
                meta: { projectId, period },
            });
        }
        catch (error) {
            return res.status(500).json({ status: "error", message: error.message });
        }
    }
    static async comparePerformance(req, res) {
        try {
            const { projectId } = req.params;
            const { currentPeriod, baselinePeriod, metrics } = req.body;
            const data = await regression_service_1.RegressionService.comparePerformance(projectId, {
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
        }
        catch (error) {
            return res.status(500).json({ status: "error", message: error.message });
        }
    }
}
exports.RegressionController = RegressionController;
