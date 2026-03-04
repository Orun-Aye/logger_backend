"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EscalationPolicyController = void 0;
const escalationPolicy_model_1 = require("../models/escalationPolicy.model");
const mongoose_1 = require("mongoose");
class EscalationPolicyController {
    /**
     * Create escalation policy
     * POST /api/v1/escalation-policies
     */
    static async create(req, res) {
        try {
            const data = req.body;
            // Validation
            if (!data.name || !data.projectId || !data.levels || data.levels.length === 0) {
                return res.status(400).json({
                    status: "error",
                    message: "Missing required fields: name, projectId, and levels are required",
                });
            }
            // Validate levels
            for (const level of data.levels) {
                if (!level.level ||
                    level.delayMinutes === undefined ||
                    !level.notifyChannels ||
                    level.notifyChannels.length === 0 ||
                    !level.recipients ||
                    level.recipients.length === 0) {
                    return res.status(400).json({
                        status: "error",
                        message: "Each escalation level must have level, delayMinutes, notifyChannels, and recipients",
                    });
                }
            }
            const policy = await escalationPolicy_model_1.EscalationPolicyModel.create({
                ...data,
                projectId: new mongoose_1.Types.ObjectId(data.projectId),
                createdBy: req.userId ? new mongoose_1.Types.ObjectId(req.userId) : undefined,
            });
            res.status(201).json({
                status: "success",
                data: policy,
            });
        }
        catch (err) {
            console.error("Create escalation policy error:", err);
            res.status(500).json({
                status: "error",
                message: "Failed to create escalation policy",
                details: err.message,
            });
        }
    }
    /**
     * Get escalation policies for a project
     * GET /api/v1/escalation-policies/project/:projectId
     */
    static async getByProject(req, res) {
        try {
            const { projectId } = req.params;
            const isActive = req.query.isActive === "true";
            const query = {
                projectId: new mongoose_1.Types.ObjectId(projectId),
            };
            if (isActive !== undefined) {
                query.isActive = isActive;
            }
            const policies = await escalationPolicy_model_1.EscalationPolicyModel.find(query)
                .populate("createdBy", "name email")
                .sort({ createdAt: -1 })
                .lean();
            res.status(200).json({
                status: "success",
                data: policies,
            });
        }
        catch (err) {
            console.error("Get escalation policies error:", err);
            res.status(500).json({
                status: "error",
                message: "Failed to fetch escalation policies",
            });
        }
    }
    /**
     * Get escalation policy by ID
     * GET /api/v1/escalation-policies/:id
     */
    static async getById(req, res) {
        try {
            const policy = await escalationPolicy_model_1.EscalationPolicyModel.findById(req.params.id)
                .populate("createdBy", "name email")
                .lean();
            if (!policy) {
                return res.status(404).json({
                    status: "error",
                    message: "Escalation policy not found",
                });
            }
            res.status(200).json({
                status: "success",
                data: policy,
            });
        }
        catch (err) {
            console.error("Get escalation policy error:", err);
            res.status(500).json({
                status: "error",
                message: "Failed to fetch escalation policy",
            });
        }
    }
    /**
     * Update escalation policy
     * PUT /api/v1/escalation-policies/:id
     */
    static async update(req, res) {
        try {
            const data = req.body;
            const policy = await escalationPolicy_model_1.EscalationPolicyModel.findByIdAndUpdate(req.params.id, { $set: data }, { new: true, runValidators: true });
            if (!policy) {
                return res.status(404).json({
                    status: "error",
                    message: "Escalation policy not found",
                });
            }
            res.status(200).json({
                status: "success",
                data: policy,
            });
        }
        catch (err) {
            console.error("Update escalation policy error:", err);
            res.status(500).json({
                status: "error",
                message: "Failed to update escalation policy",
            });
        }
    }
    /**
     * Delete escalation policy (soft delete by setting isActive = false)
     * DELETE /api/v1/escalation-policies/:id
     */
    static async delete(req, res) {
        try {
            const hardDelete = req.query.hard === "true";
            if (hardDelete) {
                await escalationPolicy_model_1.EscalationPolicyModel.findByIdAndDelete(req.params.id);
            }
            else {
                await escalationPolicy_model_1.EscalationPolicyModel.findByIdAndUpdate(req.params.id, {
                    $set: { isActive: false },
                });
            }
            res.status(204).send();
        }
        catch (err) {
            console.error("Delete escalation policy error:", err);
            res.status(500).json({
                status: "error",
                message: "Failed to delete escalation policy",
            });
        }
    }
}
exports.EscalationPolicyController = EscalationPolicyController;
