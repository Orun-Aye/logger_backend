import { Request, Response } from "express";
import {
  AlertRuleService,
  ProjectNotFoundError,
  RuleServiceError,
} from "../services/alertRule.service";
import { AlertService } from "../services/alert.service";
import { CreateAlertRuleDTO } from "../dtos/alertRule.dto";
import {
  SnoozeAlertRuleDTO,
  AlertAnalyticsQueryDTO,
  AlertTimelineQueryDTO,
} from "../dtos/alert.dto";

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
        details: (err as Error).message, // Include for debugging
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

  // === PHASE 2.2 ENHANCEMENTS ===

  /**
   * Test an alert rule against recent logs (dry-run)
   * POST /api/v1/alert-rules/:id/test
   */
  static async testRule(req: Request, res: Response) {
    try {
      const ruleId = req.params.id;
      const limitLogs = parseInt(req.query.limit as string) || 100;

      const result = await AlertService.testAlertRule(ruleId, limitLogs);

      res.status(200).json({
        status: "success",
        data: {
          ruleId,
          matchedCount: result.matched,
          previewLogs: result.logs,
          message: `Rule would match ${result.matched} out of ${limitLogs} recent logs`,
        },
      });
    } catch (err) {
      console.error("Test rule error:", err);
      res.status(500).json({
        status: "error",
        message: "Failed to test alert rule",
        details: (err as Error).message,
      });
    }
  }

  /**
   * Snooze an alert rule for a specified duration
   * POST /api/v1/alert-rules/:id/snooze
   */
  static async snoozeRule(req: Request, res: Response) {
    try {
      const ruleId = req.params.id;
      const { durationMinutes, userId }: SnoozeAlertRuleDTO = req.body;

      if (!durationMinutes || durationMinutes <= 0) {
        return res.status(400).json({
          status: "error",
          message: "Invalid durationMinutes",
        });
      }

      const rule = await AlertService.snoozeAlertRule(
        ruleId,
        durationMinutes,
        userId || req.userId
      );

      res.status(200).json({
        status: "success",
        data: rule,
        message: `Rule snoozed for ${durationMinutes} minutes`,
      });
    } catch (err) {
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
  static async getAnalytics(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const timeRange = (req.query.timeRange as string) || "7d";

      const analytics = await AlertService.getAlertAnalytics(
        projectId,
        timeRange
      );

      res.status(200).json({
        status: "success",
        data: analytics,
      });
    } catch (err) {
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
  static async getTimeline(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          status: "error",
          message: "startDate and endDate are required",
        });
      }

      const timeline = await AlertService.getAlertTimeline(
        projectId,
        new Date(startDate as string),
        new Date(endDate as string)
      );

      res.status(200).json({
        status: "success",
        data: timeline,
      });
    } catch (err) {
      console.error("Get alert timeline error:", err);
      res.status(500).json({
        status: "error",
        message: "Failed to fetch alert timeline",
      });
    }
  }
}
