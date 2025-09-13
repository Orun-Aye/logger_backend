"use strict";
// @ts-nocheck
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertRuleController = void 0;
const alertRule_service_1 = require("../services/alertRule.service");
class AlertRuleController {
    static async create(req, res) {
        try {
            const rule = await alertRule_service_1.AlertRuleService.createRule({
                ...req.body,
                projectId: req.projectId,
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
            const rules = await alertRule_service_1.AlertRuleService.getRulesByProject(req.projectId);
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
}
exports.AlertRuleController = AlertRuleController;
