"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertRuleController = void 0;
const alertRule_service_1 = require("../services/alertRule.service");
const alert_service_1 = require("../services/alert.service");
class AlertRuleController {
    static async create(req, res) {
        try {
            const { name, projectId, condition, isActive = true, notifyChannels = ["email"], notificationConfig = {}, } = req.body;
            if (!name || !condition) {
                return res.status(400).json({
                    success: false,
                    error: "Missing required fields: name and condition are required"
                });
            }
            if (!condition.level) {
                return res.status(400).json({
                    success: false,
                    error: "Condition must include level"
                });
            }
            const rule = await alertRule_service_1.AlertRuleService.createRule({
                ...req.body,
                projectId: req.body.projectId
            });
            res.status(201).json({ status: "success", data: rule });
        }
        catch (err) {
            console.error("Alert rule creation error:", err); // Add logging
            // Handle specific error types
            if (err instanceof alertRule_service_1.RuleServiceError) {
                return res.status(400).json({ status: "error", message: err.message });
            }
            if (err instanceof alertRule_service_1.ProjectNotFoundError) {
                return res.status(404).json({ status: "error", message: err.message });
            }
            // Generic error
            res.status(500).json({
                status: "error",
                message: "Failed to create alert rule.",
                details: err.message, // Include for debugging
            });
        }
    }
    static async getRuleByProject(req, res) {
        try {
            const projectId = req.params.projectId;
            const rules = await alertRule_service_1.AlertRuleService.getRulesByProject(projectId);
            res.status(200).json({ status: "success", data: rules });
        }
        catch (err) {
            res
                .status(500)
                .json({ status: "error", message: "Failed to fetch rules." });
        }
    }
    static async getRuleById(req, res) {
        try {
            const rule = await alertRule_service_1.AlertRuleService.getRuleById(req.params.id);
            res.status(200).json({ status: "success", data: rule });
        }
        catch (error) {
            res
                .status(500)
                .json({ status: "error", message: "Failed to fetch rule." });
        }
    }
    static async update(req, res) {
        try {
            const updated = await alertRule_service_1.AlertRuleService.updateRule(req.params.id, req.body);
            res.status(200).json({ status: "success", data: updated });
        }
        catch (err) {
            res.status(500).json({ status: "error", message: "Update failed." });
        }
    }
    static async delete(req, res) {
        try {
            await alertRule_service_1.AlertRuleService.deleteRule(req.params.id);
            res.status(204).send();
        }
        catch (err) {
            res.status(500).json({ status: "error", message: "Delete failed." });
        }
    }
    // === PHASE 2.2 ENHANCEMENTS ===
    /**
     * Test an alert rule against recent logs (dry-run)
     * POST /api/v1/alert-rules/:id/test
     */
    static async testRule(req, res) {
        try {
            const ruleId = req.params.id;
            const limitLogs = parseInt(req.query.limit) || 100;
            const result = await alert_service_1.AlertService.testAlertRule(ruleId, limitLogs);
            res.status(200).json({
                status: "success",
                data: {
                    ruleId,
                    matchedCount: result.matched,
                    previewLogs: result.logs,
                    message: `Rule would match ${result.matched} out of ${limitLogs} recent logs`,
                },
            });
        }
        catch (err) {
            console.error("Test rule error:", err);
            res.status(500).json({
                status: "error",
                message: "Failed to test alert rule",
                details: err.message,
            });
        }
    }
    /**
     * Snooze an alert rule for a specified duration
     * POST /api/v1/alert-rules/:id/snooze
     */
    static async snoozeRule(req, res) {
        try {
            const ruleId = req.params.id;
            const { durationMinutes, userId } = req.body;
            if (!durationMinutes || durationMinutes <= 0) {
                return res.status(400).json({
                    status: "error",
                    message: "Invalid durationMinutes",
                });
            }
            const rule = await alert_service_1.AlertService.snoozeAlertRule(ruleId, durationMinutes, userId || req.userId);
            res.status(200).json({
                status: "success",
                data: rule,
                message: `Rule snoozed for ${durationMinutes} minutes`,
            });
        }
        catch (err) {
            console.error("Snooze rule error:", err);
            res.status(500).json({
                status: "error",
                message: "Failed to snooze alert rule",
            });
        }
    }
    /**
     * Get alert analytics (frequency trends, MTTR, noisiest rules)
     * GET /api/v1/alert-rules/analytics/:projectId
     */
    static async getAnalytics(req, res) {
        try {
            const { projectId } = req.params;
            const timeRange = req.query.timeRange || "7d";
            const analytics = await alert_service_1.AlertService.getAlertAnalytics(projectId, timeRange);
            res.status(200).json({
                status: "success",
                data: analytics,
            });
        }
        catch (err) {
            console.error("Get alert analytics error:", err);
            res.status(500).json({
                status: "error",
                message: "Failed to fetch alert analytics",
            });
        }
    }
    /**
     * Get alert timeline for incident tracking
     * GET /api/v1/alert-rules/timeline/:projectId
     */
    static async getTimeline(req, res) {
        try {
            const { projectId } = req.params;
            const { startDate, endDate } = req.query;
            if (!startDate || !endDate) {
                return res.status(400).json({
                    status: "error",
                    message: "startDate and endDate are required",
                });
            }
            const timeline = await alert_service_1.AlertService.getAlertTimeline(projectId, new Date(startDate), new Date(endDate));
            res.status(200).json({
                status: "success",
                data: timeline,
            });
        }
        catch (err) {
            console.error("Get alert timeline error:", err);
            res.status(500).json({
                status: "error",
                message: "Failed to fetch alert timeline",
            });
        }
    }
}
exports.AlertRuleController = AlertRuleController;
