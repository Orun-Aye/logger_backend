// @ts-nocheck

import { Request, Response } from "express";
import {
  AlertRuleService,
  ProjectNotFoundError,
  RuleServiceError,
} from "../services/alertRule.service";
import { CreateAlertRuleDTO } from "../dtos/alertRule.dto";

export class AlertRuleController {
  static async create(req: Request, res: Response) {
    try {
      const {
        name,
        projectId,
        condition,
        isActive = true,
        notifyChannels = ["email"],
        notificationConfig = {},
      }: CreateAlertRuleDTO = req.body;

      if (!name || !condition) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: name and condition are required"
        })
      }

      if (!condition.level) {
        return res.status(400).json({
          success: false,
          error: "Condition must include level"
        });
      }

      const rule = await AlertRuleService.createRule({
        ...(req.body as CreateAlertRuleDTO),
        projectId: req.body.projectId
      });
      res.status(201).json({ status: "success", data: rule });
    } catch (err) {
      console.error("Alert rule creation error:", err); // Add logging

      // Handle specific error types
      if (err instanceof RuleServiceError) {
        return res.status(400).json({ status: "error", message: err.message });
      }
      if (err instanceof ProjectNotFoundError) {
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

  static async getRuleByProject(req: Request, res: Response) {
    try {
      const projectId = req.params.projectId
      const rules = await AlertRuleService.getRulesByProject(projectId);
      res.status(200).json({ status: "success", data: rules });
    } catch (err) {
      res
        .status(500)
        .json({ status: "error", message: "Failed to fetch rules." });
    }
  }

  static async getRuleById(req: Request, res: Response) {
    try {
      const rule = await AlertRuleService.getRuleById(req.params.id);
      res.status(200).json({ status: "success", data: rule });
    } catch (error) {
      res
        .status(500)
        .json({ status: "error", message: "Failed to fetch rule." });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const updated = await AlertRuleService.updateRule(
        req.params.id,
        req.body
      );
      res.status(200).json({ status: "success", data: updated });
    } catch (err) {
      res.status(500).json({ status: "error", message: "Update failed." });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      await AlertRuleService.deleteRule(req.params.id);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ status: "error", message: "Delete failed." });
    }
  }
}
