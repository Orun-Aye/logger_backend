// src/services/alertRule.service.ts

import { AlertRuleModel, IAlertRules } from "../models/alertRule.model";
import { CreateAlertRuleDTO, UpdateAlertRuleDTO } from "../dtos/alertRule.dto";
import { Types } from "mongoose";
import { LogModel } from "../models/log.model";

export class RuleNotFoundError extends Error {
  constructor(id: Types.ObjectId) {
    super(`AlertRule with Project/ID: ${id} not found`);
    this.name = "AlertRuleNotFoundError";
  }
}

export class RuleServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AlertServiceError";
  }
}

export class ProjectNotFoundError extends Error {
  constructor(projectId: Types.ObjectId) {
    super(`Project with ID: ${projectId} not found or invalid`);
    this.name = "ProjectNotFoundError";
  }
}

export class AlertRuleService {
  /**
   * Validates if a projectId exists in the system
   * This method should be implemented based on your project management setup
   */
  private static async validateProjectId(
    projectId: Types.ObjectId
  ): Promise<boolean> {
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
      if (!Types.ObjectId.isValid(projectId)) {
        return false;
      }

      // For demonstration, I'll use Option 3 - checking against existing logs
      // Replace this with your actual project validation logic
      const projectExists = await LogModel.findOne({ projectId })
        .select("_id")
        .lean();
      return !!projectExists;
    } catch (error) {
      console.error("Error validating project ID:", error);
      return false;
    }
  }

  static async createRule(data: CreateAlertRuleDTO) {
    try {
      // 1. First validate the projectId format
      if (!Types.ObjectId.isValid(data.projectId)) {
        throw new RuleServiceError("Invalid Project ID format");
      }

      // 2. Check if the project exists
      const isValidProject = await this.validateProjectId(data.projectId);
      if (!isValidProject) {
        throw new ProjectNotFoundError(data.projectId);
      }

      // 3. Check for existing rule with same name in the project
      const existingRule = await AlertRuleModel.findOne({
        projectId: data.projectId,
        name: data.name,
      });

      if (existingRule) {
        throw new RuleServiceError(
          "Alert Rule with the same name already set for this project."
        );
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
      const newRule = await AlertRuleModel.create(ruleData);

      return newRule.toObject() as IAlertRules;
    } catch (error) {
      if (
        error instanceof RuleNotFoundError ||
        error instanceof RuleServiceError ||
        error instanceof ProjectNotFoundError
      ) {
        throw error;
      }
      throw new Error(`Failed to create alert rule: ${error}`);
    }
  }

  static async getRulesByProject(projectId: Types.ObjectId) {
    try {
      // Validate projectId format
      if (!Types.ObjectId.isValid(projectId)) {
        throw new RuleServiceError("Invalid Project ID format");
      }

      // Validate project exists
      const isValidProject = await this.validateProjectId(projectId);
      if (!isValidProject) {
        throw new ProjectNotFoundError(projectId);
      }

      const rules = await AlertRuleModel.find({ projectId });

      if (!rules) {
        throw new RuleNotFoundError(projectId);
      }

      return rules;
    } catch (error) {
      if (
        error instanceof RuleNotFoundError ||
        error instanceof RuleServiceError ||
        error instanceof ProjectNotFoundError
      ) {
        throw error;
      }
      throw new Error(`Failed to get rules: ${error}`);
    }
  }

  static async getRuleById(ruleId: Types.ObjectId) {
    try {
      if (!Types.ObjectId.isValid(ruleId)) {
        throw new RuleServiceError("Invalid Rule ID");
      }

      const rule = await AlertRuleModel.findById(ruleId).select("-__v").lean();

      if (!rule) {
        throw new RuleNotFoundError(ruleId);
      }

      return rule as IAlertRules;
    } catch (error) {
      if (
        error instanceof RuleNotFoundError ||
        error instanceof RuleServiceError ||
        error instanceof ProjectNotFoundError
      ) {
        throw error;
      }
      throw new Error(`Failed to get rule: ${error}`);
    }
  }

  /**
   * Updates an alert rule
   */
  static async updateRule(
    ruleId: Types.ObjectId,
    data: UpdateAlertRuleDTO
  ): Promise<IAlertRules> {
    try {
      if (!Types.ObjectId.isValid(ruleId)) {
        throw new RuleServiceError("Invalid Rule ID format");
      }

      const existingRule = await AlertRuleModel.findById(ruleId);
      if (!existingRule) {
        throw new RuleNotFoundError(ruleId);
      }

      // If projectId is being updated, validate the new projectId
      if (data.projectId && !data.projectId.equals(existingRule.projectId)) {
        if (!Types.ObjectId.isValid(data.projectId)) {
          throw new RuleServiceError("Invalid Project ID format");
        }

        const isValidProject = await this.validateProjectId(data.projectId);
        if (!isValidProject) {
          throw new ProjectNotFoundError(data.projectId);
        }
      }

      // Check for name conflicts if name is being updated
      if (data.name && data.name !== existingRule.name) {
        const existingWithName = await AlertRuleModel.findOne({
          projectId: data.projectId || existingRule.projectId,
          name: data.name,
          _id: { $ne: ruleId }
        });

        if (existingWithName) {
          throw new RuleServiceError(
            "Alert Rule with the same name already exists for this project."
          );
        }
      }

      // Prepare update data to match schema structure
      const updateData: any = {};
      
      if (data.name !== undefined) updateData.name = data.name;
      if (data.projectId !== undefined) updateData.projectId = data.projectId;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      if (data.notifyChannels !== undefined) updateData.notifyChannels = data.notifyChannels;
      if (data.notificationConfig !== undefined) updateData.notificationConfig = data.notificationConfig;
      
      // Handle condition updates
      if (data.condition) {
        updateData.condition = {};
        if (data.condition.level !== undefined) updateData.condition.level = data.condition.level;
        if (data.condition.keyword !== undefined) updateData.condition.keyword = data.condition.keyword;
        if (data.condition.frequency !== undefined) updateData.condition.frequency = data.condition.frequency;
        if (data.condition.intervalMinutes !== undefined) updateData.condition.intervalMinutes = data.condition.intervalMinutes;
      }

      const updatedRule = await AlertRuleModel.findByIdAndUpdate(
        ruleId,
        updateData,
        {
          new: true,
          runValidators: true,
          select: "-__v",
        }
      ).lean();

      if (!updatedRule) {
        throw new RuleNotFoundError(ruleId);
      }

      return updatedRule as IAlertRules;
    } catch (error) {
      if (
        error instanceof RuleNotFoundError ||
        error instanceof RuleServiceError ||
        error instanceof ProjectNotFoundError
      ) {
        throw error;
      }
      throw new Error(
        `Failed to update rule: ${error}`,
      );
    }
  }

  static async deleteRule(ruleId: Types.ObjectId) {
    try {
      const deletedRule = await AlertRuleModel.findByIdAndDelete(ruleId);

      if (!deletedRule) {
        throw new RuleNotFoundError(ruleId);
      }

      return { success: true, deletedId: ruleId };
    } catch (error) {
      if (
        error instanceof RuleNotFoundError ||
        error instanceof RuleServiceError ||
        error instanceof ProjectNotFoundError
      ) {
        throw error;
      }
      throw new Error(`Failed to delete rule: ${error}`);
    }
  }
}
