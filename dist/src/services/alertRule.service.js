"use strict";
// src/services/alertRule.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertRuleService = exports.ProjectNotFoundError = exports.RuleServiceError = exports.RuleNotFoundError = void 0;
const alertRule_model_1 = require("../models/alertRule.model");
const mongoose_1 = require("mongoose");
const log_model_1 = require("../models/log.model");
class RuleNotFoundError extends Error {
    constructor(id) {
        super(`AlertRule with Project/ID: ${id} not found`);
        this.name = "AlertRuleNotFoundError";
    }
}
exports.RuleNotFoundError = RuleNotFoundError;
class RuleServiceError extends Error {
    constructor(message) {
        super(message);
        this.name = "AlertServiceError";
    }
}
exports.RuleServiceError = RuleServiceError;
class ProjectNotFoundError extends Error {
    constructor(projectId) {
        super(`Project with ID: ${projectId} not found or invalid`);
        this.name = "ProjectNotFoundError";
    }
}
exports.ProjectNotFoundError = ProjectNotFoundError;
class AlertRuleService {
    /**
     * Validates if a projectId exists in the system
     * This method should be implemented based on your project management setup
     */
    static async validateProjectId(projectId) {
        try {
            // Option 1: If you have a Project model
            // import { ProjectModel } from "../models/project.model";
            // const project = await ProjectModel.findById(projectId);
            // return !!project;
            // Option 3: Check if projectId exists in logs (assuming projects are created when first log is sent)
            // import { LogModel } from "../models/log.model";
            // const logExists = await LogModel.findOne({ projectId });
            // return !!logExists;
            // Option 4: Simple ObjectId validation (basic check)
            if (!mongoose_1.Types.ObjectId.isValid(projectId)) {
                return false;
            }
            // For demonstration, I'll use Option 3 - checking against existing logs
            // Replace this with your actual project validation logic
            const projectExists = await log_model_1.LogModel.findOne({ projectId })
                .select("_id")
                .lean();
            return !!projectExists;
        }
        catch (error) {
            console.error("Error validating project ID:", error);
            return false;
        }
    }
    static async createRule(data) {
        try {
            // 1. First validate the projectId format
            if (!mongoose_1.Types.ObjectId.isValid(data.projectId)) {
                throw new RuleServiceError("Invalid Project ID format");
            }
            // 2. Check if the project exists
            const isValidProject = await this.validateProjectId(data.projectId);
            if (!isValidProject) {
                throw new ProjectNotFoundError(data.projectId);
            }
            // 3. Check for existing rule with same name in the project
            const existingRule = await alertRule_model_1.AlertRuleModel.findOne({
                projectId: data.projectId,
                name: data.name,
            });
            if (existingRule) {
                throw new RuleServiceError("Alert Rule with the same name already set for this project.");
            }
            const ruleData = {
                projectId: data.projectId,
                name: data.name,
                condition: {
                    level: data.condition.level,
                    // Map DTO fields to schema fields
                    keyword: data.condition.keyword,
                    frequency: data.condition.frequency,
                    intervalMinutes: data.condition.intervalMinutes,
                },
                isActive: data.isActive ?? true,
                // Map notifyChannels (schema) from notifyChannels (DTO)
                notifyChannels: data.notifyChannels || ["email"],
                notificationConfig: data.notificationConfig || {},
            };
            // 4. Create the new rule
            const newRule = await alertRule_model_1.AlertRuleModel.create(ruleData);
            return newRule.toObject();
        }
        catch (error) {
            if (error instanceof RuleNotFoundError ||
                error instanceof RuleServiceError ||
                error instanceof ProjectNotFoundError) {
                throw error;
            }
            throw new Error(`Failed to create alert rule: ${error}`);
        }
    }
    static async getRulesByProject(projectId) {
        try {
            // Validate projectId format
            if (!mongoose_1.Types.ObjectId.isValid(projectId)) {
                throw new RuleServiceError("Invalid Project ID format");
            }
            // Validate project exists
            const isValidProject = await this.validateProjectId(projectId);
            if (!isValidProject) {
                throw new ProjectNotFoundError(projectId);
            }
            const rules = await alertRule_model_1.AlertRuleModel.find({ projectId });
            if (!rules) {
                throw new RuleNotFoundError(projectId);
            }
            return rules;
        }
        catch (error) {
            if (error instanceof RuleNotFoundError ||
                error instanceof RuleServiceError ||
                error instanceof ProjectNotFoundError) {
                throw error;
            }
            throw new Error(`Failed to get rules: ${error}`);
        }
    }
    static async getRuleById(ruleId) {
        try {
            if (!mongoose_1.Types.ObjectId.isValid(ruleId)) {
                throw new RuleServiceError("Invalid Rule ID");
            }
            const rule = await alertRule_model_1.AlertRuleModel.findById(ruleId).select("-__v").lean();
            if (!rule) {
                throw new RuleNotFoundError(ruleId);
            }
            return rule;
        }
        catch (error) {
            if (error instanceof RuleNotFoundError ||
                error instanceof RuleServiceError ||
                error instanceof ProjectNotFoundError) {
                throw error;
            }
            throw new Error(`Failed to get rule: ${error}`);
        }
    }
    /**
     * Updates an alert rule
     */
    static async updateRule(ruleId, data) {
        try {
            if (!mongoose_1.Types.ObjectId.isValid(ruleId)) {
                throw new RuleServiceError("Invalid Rule ID format");
            }
            const existingRule = await alertRule_model_1.AlertRuleModel.findById(ruleId);
            if (!existingRule) {
                throw new RuleNotFoundError(ruleId);
            }
            // If projectId is being updated, validate the new projectId
            if (data.projectId && !data.projectId.equals(existingRule.projectId)) {
                if (!mongoose_1.Types.ObjectId.isValid(data.projectId)) {
                    throw new RuleServiceError("Invalid Project ID format");
                }
                const isValidProject = await this.validateProjectId(data.projectId);
                if (!isValidProject) {
                    throw new ProjectNotFoundError(data.projectId);
                }
            }
            // Check for name conflicts if name is being updated
            if (data.name && data.name !== existingRule.name) {
                const existingWithName = await alertRule_model_1.AlertRuleModel.findOne({
                    projectId: data.projectId || existingRule.projectId,
                    name: data.name,
                    _id: { $ne: ruleId }
                });
                if (existingWithName) {
                    throw new RuleServiceError("Alert Rule with the same name already exists for this project.");
                }
            }
            // Prepare update data to match schema structure
            const updateData = {};
            if (data.name !== undefined)
                updateData.name = data.name;
            if (data.projectId !== undefined)
                updateData.projectId = data.projectId;
            if (data.isActive !== undefined)
                updateData.isActive = data.isActive;
            if (data.notifyChannels !== undefined)
                updateData.notifyChannels = data.notifyChannels;
            if (data.notificationConfig !== undefined)
                updateData.notificationConfig = data.notificationConfig;
            // Handle condition updates
            if (data.condition) {
                updateData.condition = {};
                if (data.condition.level !== undefined)
                    updateData.condition.level = data.condition.level;
                if (data.condition.keyword !== undefined)
                    updateData.condition.keyword = data.condition.keyword;
                if (data.condition.frequency !== undefined)
                    updateData.condition.frequency = data.condition.frequency;
                if (data.condition.intervalMinutes !== undefined)
                    updateData.condition.intervalMinutes = data.condition.intervalMinutes;
            }
            const updatedRule = await alertRule_model_1.AlertRuleModel.findByIdAndUpdate(ruleId, updateData, {
                new: true,
                runValidators: true,
                select: "-__v",
            }).lean();
            if (!updatedRule) {
                throw new RuleNotFoundError(ruleId);
            }
            return updatedRule;
        }
        catch (error) {
            if (error instanceof RuleNotFoundError ||
                error instanceof RuleServiceError ||
                error instanceof ProjectNotFoundError) {
                throw error;
            }
            throw new Error(`Failed to update rule: ${error}`);
        }
    }
    static async deleteRule(ruleId) {
        try {
            const deletedRule = await alertRule_model_1.AlertRuleModel.findByIdAndDelete(ruleId);
            if (!deletedRule) {
                throw new RuleNotFoundError(ruleId);
            }
            return { success: true, deletedId: ruleId };
        }
        catch (error) {
            if (error instanceof RuleNotFoundError ||
                error instanceof RuleServiceError ||
                error instanceof ProjectNotFoundError) {
                throw error;
            }
            throw new Error(`Failed to delete rule: ${error}`);
        }
    }
}
exports.AlertRuleService = AlertRuleService;
