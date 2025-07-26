// src/services/alertRule.service.ts

import { AlertRuleModel } from "../models/alertRule.model";
import { CreateAlertRuleDTO, UpdateAlertRuleDTO } from "../dtos/alertRule.dto";
import { Types } from "mongoose";

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
      const { LogModel } = await import("../models/log.model");
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

      // 4. Create the new rule
      const newRule = await AlertRuleModel.create({
        ...data,
        timestamp: new Date(),
      });

      return newRule;
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

      return rule;
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

  static async updateRule(ruleId: Types.ObjectId, data: UpdateAlertRuleDTO) {
    try {
      const existingRule = await AlertRuleModel.findById(ruleId);
      if (!existingRule) {
        throw new RuleNotFoundError(ruleId);
      }

      // If projectId is being updated, validate the new projectId
      if (data.projectId && data.projectId !== existingRule.projectId) {
        if (!Types.ObjectId.isValid(data.projectId)) {
          throw new RuleServiceError("Invalid Project ID format");
        }

        const isValidProject = await this.validateProjectId(data.projectId);
        if (!isValidProject) {
          throw new ProjectNotFoundError(data.projectId);
        }
      }

      const updatedRule = await AlertRuleModel.findByIdAndUpdate(ruleId, data, {
        new: true,
        runValidators: true,
        select: "-__v",
      }).lean();

      return updatedRule;
    } catch (error) {
      if (
        error instanceof RuleNotFoundError ||
        error instanceof RuleServiceError ||
        error instanceof ProjectNotFoundError
      ) {
        throw error;
      }
      throw new Error(`Failed to update rule: ${error}`);
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
