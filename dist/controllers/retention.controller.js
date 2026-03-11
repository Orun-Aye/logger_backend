"use strict";
// src/controllers/retention.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetentionController = void 0;
const retention_service_1 = require("../services/retention.service");
class RetentionController {
    /**
     * Preview the impact of applying a retention policy for a project.
     */
    static async previewRetention(req, res) {
        try {
            const { projectId } = req.params;
            const { retentionDays } = req.query;
            if (!retentionDays || isNaN(Number(retentionDays))) {
                return res.status(400).json({
                    status: "error",
                    message: "retentionDays query parameter is required and must be a number",
                });
            }
            const preview = await retention_service_1.RetentionService.previewRetentionImpact(projectId, Number(retentionDays));
            return res.status(200).json({
                status: "success",
                message: "Retention impact preview generated successfully",
                data: preview,
            });
        }
        catch (error) {
            console.error("RetentionController: Preview failed:", error);
            return res.status(500).json({
                status: "error",
                message: error instanceof Error ? error.message : "Failed to preview retention impact",
            });
        }
    }
    /**
     * Apply retention policy for a specific project.
     */
    static async applyRetention(req, res) {
        try {
            const { projectId } = req.params;
            const { retentionDays, samplingRate } = req.body;
            if (!retentionDays || isNaN(Number(retentionDays))) {
                return res.status(400).json({
                    status: "error",
                    message: "retentionDays is required and must be a number",
                });
            }
            const policy = {
                retentionDays: Number(retentionDays),
                samplingRate: samplingRate ? Number(samplingRate) : undefined,
            };
            const result = samplingRate
                ? await retention_service_1.RetentionService.applyRetentionWithSampling(projectId, policy)
                : await retention_service_1.RetentionService.applyRetentionPolicy(projectId, policy);
            return res.status(200).json({
                status: "success",
                message: `Retention policy applied: ${result.deletedCount} logs deleted${result.sampledCount ? `, ${result.sampledCount} logs sampled` : ""}`,
                data: result,
            });
        }
        catch (error) {
            console.error("RetentionController: Apply retention failed:", error);
            return res.status(500).json({
                status: "error",
                message: error instanceof Error ? error.message : "Failed to apply retention policy",
            });
        }
    }
    /**
     * Apply sampling to logs for a specific project.
     */
    static async applySampling(req, res) {
        try {
            const { projectId } = req.params;
            const { samplingRate, startDate, endDate } = req.body;
            if (!samplingRate || isNaN(Number(samplingRate))) {
                return res.status(400).json({
                    status: "error",
                    message: "samplingRate is required and must be a number between 0 and 100",
                });
            }
            const result = await retention_service_1.RetentionService.applySampling(projectId, Number(samplingRate), startDate ? new Date(startDate) : undefined, endDate ? new Date(endDate) : undefined);
            return res.status(200).json({
                status: "success",
                message: `Sampling applied: ${result.deletedCount} logs deleted, ${result.sampledCount} logs kept`,
                data: result,
            });
        }
        catch (error) {
            console.error("RetentionController: Apply sampling failed:", error);
            return res.status(500).json({
                status: "error",
                message: error instanceof Error ? error.message : "Failed to apply sampling",
            });
        }
    }
    /**
     * Run retention for all projects (admin only).
     */
    static async runAllProjectRetention(req, res) {
        try {
            const { defaultRetentionDays } = req.body;
            const results = await retention_service_1.RetentionService.runAllProjectRetention(defaultRetentionDays ? Number(defaultRetentionDays) : 30);
            const totalDeleted = results.reduce((sum, r) => sum + r.deletedCount, 0);
            return res.status(200).json({
                status: "success",
                message: `Processed ${results.length} projects, deleted ${totalDeleted} logs`,
                data: {
                    projectsProcessed: results.length,
                    totalLogsDeleted: totalDeleted,
                    results: results,
                },
            });
        }
        catch (error) {
            console.error("RetentionController: Run all retention failed:", error);
            return res.status(500).json({
                status: "error",
                message: error instanceof Error ? error.message : "Failed to run retention for all projects",
            });
        }
    }
}
exports.RetentionController = RetentionController;
