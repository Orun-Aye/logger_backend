import { Types } from "mongoose";
import { AlertRuleModel } from "../models/alertRule.model";
import { AlertEventModel, IAlertEvent } from "../models/alertEvent.model";
import { LogModel, ILog } from "../models/log.model";
import { ProjectModel } from "../models/project.model";
import { NotificationService } from "./notification.service";
import { globalServices } from "../server";

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type RuleCondition = {
  level?: string;
  keyword?: string;
  frequency?: number;
  intervalMinutes?: number;
};

type AlertFilters = {
  projectId?: string;
  severity?: "info" | "warning" | "critical";
  status?: "active" | "acknowledged" | "resolved" | "snoozed";
  ruleId?: string;
  startDate?: string;
  endDate?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
  userId?: string; // when projectId is not provided, scope by user
};

type AlertStats = {
  total: number;
  active: number;
  acknowledged: number;
  resolved: number;
  snoozed: number;
  bySeverity: {
    info: number;
    warning: number;
    critical: number;
  };
  byTimeRange: {
    last24h: number;
    last7d: number;
    last30d: number;
  };
};

export class AlertService {
  static async evaluateLogAndTrigger(log: ILog) {
    try {
      const projectId = new Types.ObjectId(log.projectId);
      const activeRules = await AlertRuleModel.find({
        projectId,
        isActive: true,
      }).lean();
      if (!activeRules.length) return;

      for (const rule of activeRules) {
        const condition: RuleCondition = rule.condition || {};
        const matchLevel = !condition.level || log.level === condition.level;
        const matchKeyword =
          !condition.keyword ||
          (log.message || "")
            .toLowerCase()
            .includes(String(condition.keyword).toLowerCase());
        if (!(matchLevel && matchKeyword)) continue;

        // Frequency threshold within time window
        if (condition.frequency && condition.intervalMinutes) {
          const since = new Date(
            Date.now() - condition.intervalMinutes * 60 * 1000
          ).toISOString();
          const keywordFilter = condition.keyword
            ? { message: { $regex: escapeRegex(condition.keyword), $options: "i" } }
            : {};
          const count = await LogModel.countDocuments({
            projectId: log.projectId,
            level: condition.level || log.level,
            timestamp: { $gte: since },
            ...keywordFilter,
          });
          if (count < condition.frequency) continue;
        }

        // Check for duplicate alerts to prevent spam
        const isDuplicate = await this.isDuplicateAlert(
          projectId,
          rule._id as Types.ObjectId,
          log
        );
        if (isDuplicate) continue;

        const severity =
          log.level === "error" || log.level === "fatal"
            ? "critical"
            : log.level === "warn"
            ? "warning"
            : "info";
        const title = `Alert: ${rule.name}`;
        const message = condition.keyword
          ? `Matched ${log.level} with keyword "${condition.keyword}"`
          : `Matched ${log.level} log rule`;

        const event = await AlertEventModel.create({
          projectId,
          ruleId: rule._id,
          logId: (log as any)._id,
          title,
          message,
          severity,
          notifyChannels: rule.notifyChannels || [],
          metadata: { log },
          triggeredAt: new Date(),
        });

        // Dispatch notifications (best-effort)
        const cfg = rule.notificationConfig || {};
        const tasks: Promise<any>[] = [];
        if (rule.notifyChannels?.includes("email") && cfg.emails?.length) {
          tasks.push(
            NotificationService.sendEmail(
              cfg.emails,
              title,
              `${message}\n${log.message}`
            )
          );
        }
        if (rule.notifyChannels?.includes("slack") && cfg.slackWebhookUrl) {
          tasks.push(
            NotificationService.sendSlack(
              cfg.slackWebhookUrl,
              `${title}: ${message}`
            )
          );
        }
        if (rule.notifyChannels?.includes("webhook") && cfg.webhookUrl) {
          tasks.push(
            NotificationService.sendWebhook(cfg.webhookUrl, { event })
          );
        }
        Promise.allSettled(tasks).catch(() => {});

        // Broadcast via websocket
        if (globalServices.dashboardWebSocketService) {
          globalServices.dashboardWebSocketService.broadcastToProject(
            String(projectId),
            "NEW_ALERT",
            { alert: event.toObject() }
          );
        }
      }
    } catch (err) {
      console.error("Alert evaluation failed", err);
    }
  }

  /**
   * Get alerts with filtering, sorting, and pagination
   */
  static async getAlerts(filters: AlertFilters = {}) {
    const {
      projectId,
      severity,
      status,
      ruleId,
      startDate,
      endDate,
      tags,
      limit = 50,
      offset = 0,
      userId,
    } = filters;

    const query: any = {};

    // Project scoping
    if (projectId) {
      query.projectId = new Types.ObjectId(projectId);
    } else if (userId) {
      // user-scoped: find all accessible projects for this user
      const projects = await ProjectModel.find({
        $or: [
          { ownerId: new Types.ObjectId(userId) },
          { "teamMembers.user": new Types.ObjectId(userId) },
        ],
        isActive: true,
      }).select({ _id: 1 });

      const accessibleProjectIds = projects.map((p) => p._id);
      if (accessibleProjectIds.length === 0) {
        return { alerts: [], total: 0, limit, offset };
      }
      query.projectId = { $in: accessibleProjectIds };
    }
    if (severity) query.severity = severity;
    if (status) query.status = status;
    if (ruleId) query.ruleId = new Types.ObjectId(ruleId);
    if (tags?.length) query.tags = { $in: tags };

    if (startDate || endDate) {
      query.triggeredAt = {};
      if (startDate) query.triggeredAt.$gte = new Date(startDate);
      if (endDate) query.triggeredAt.$lte = new Date(endDate);
    }

    const [alerts, total] = await Promise.all([
      AlertEventModel.find(query)
        .populate("ruleId", "name description")
        .populate("logId", "message level service timestamp")
        .sort({ triggeredAt: -1 })
        .limit(limit)
        .skip(offset)
        .lean(),
      AlertEventModel.countDocuments(query),
    ]);

    return { alerts, total, limit, offset };
  }

  /**
   * Get alert statistics for dashboard
   */
  static async getAlertStats(args: { projectId?: string; userId?: string }): Promise<AlertStats> {
    const { projectId, userId } = args || {};
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let matchStage: any = {};
    if (projectId) {
      matchStage.projectId = new Types.ObjectId(projectId);
    } else if (userId) {
      const projects = await ProjectModel.find({
        $or: [
          { ownerId: new Types.ObjectId(userId) },
          { "teamMembers.user": new Types.ObjectId(userId) },
        ],
        isActive: true,
      }).select({ _id: 1 });
      const accessibleProjectIds = projects.map((p) => p._id);
      if (accessibleProjectIds.length === 0) {
        return {
          total: 0,
          active: 0,
          acknowledged: 0,
          resolved: 0,
          snoozed: 0,
          bySeverity: { info: 0, warning: 0, critical: 0 },
          byTimeRange: { last24h: 0, last7d: 0, last30d: 0 },
        };
      }
      matchStage.projectId = { $in: accessibleProjectIds };
    }

    const [statusStats, severityStats, timeRangeStats] = await Promise.all([
      // Status breakdown
      AlertEventModel.aggregate([
        { $match: matchStage },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),

      // Severity breakdown
      AlertEventModel.aggregate([
        { $match: matchStage },
        { $group: { _id: "$severity", count: { $sum: 1 } } },
      ]),

      // Time range breakdown
      Promise.all([
        AlertEventModel.countDocuments({
          ...matchStage,
          triggeredAt: { $gte: last24h },
        }),
        AlertEventModel.countDocuments({
          ...matchStage,
          triggeredAt: { $gte: last7d },
        }),
        AlertEventModel.countDocuments({
          ...matchStage,
          triggeredAt: { $gte: last30d },
        }),
      ]),
    ]);

    // Process results
    const statusMap = statusStats.reduce((acc: Record<string, number>, item: { _id: string; count: number }) => {
      acc[item._id] = item.count;
      return acc;
    }, {} as Record<string, number>);

    const severityMap = severityStats.reduce((acc: Record<string, number>, item: { _id: string; count: number }) => {
      acc[item._id] = item.count;
      return acc;
    }, {} as Record<string, number>);

    const total: number = (Object.values(statusMap) as number[]).reduce(
      (sum: number, count: number) => sum + count,
      0
    );

    return {
      total,
      active: statusMap.active || 0,
      acknowledged: statusMap.acknowledged || 0,
      resolved: statusMap.resolved || 0,
      snoozed: statusMap.snoozed || 0,
      bySeverity: {
        info: severityMap.info || 0,
        warning: severityMap.warning || 0,
        critical: severityMap.critical || 0,
      },
      byTimeRange: {
        last24h: timeRangeStats[0],
        last7d: timeRangeStats[1],
        last30d: timeRangeStats[2],
      },
    };
  }

  /**
   * Update alert status (acknowledge, resolve, snooze)
   */
  static async updateAlertStatus(
    alertId: string,
    status: "acknowledged" | "resolved" | "snoozed",
    userId?: string
  ) {
    const updateData: any = {
      $set: {
        status,
        updatedAt: new Date(),
        ...(status === "acknowledged" ? { acknowledgedAt: new Date() } : {}),
      },
    };

    if (userId) {
      updateData.$push = {
        "metadata.statusHistory": {
          status,
          userId,
          timestamp: new Date(),
        },
      };
    }

    const alert = await AlertEventModel.findByIdAndUpdate(alertId, updateData, {
      new: true,
    }).populate("ruleId logId");

    if (alert) {
      // Broadcast status change
      this.broadcastAlert(alert.projectId, alert, "ALERT_STATUS_UPDATED");
    }

    return alert;
  }

  /**
   * Bulk update multiple alerts
   */
  static async bulkUpdateAlerts(
    alertIds: string[],
    status: "acknowledged" | "resolved" | "snoozed",
    userId?: string
  ) {
    const objectIds = alertIds.map((id) => new Types.ObjectId(id));

    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === "acknowledged") {
      updateData.acknowledgedAt = new Date();
    }

    const result = await AlertEventModel.updateMany(
      { _id: { $in: objectIds } },
      updateData
    );

    return result;
  }

  /**
   * Delete alerts (with optional soft delete)
   */
  static async deleteAlerts(alertIds: string[], softDelete = true) {
    const objectIds = alertIds.map((id) => new Types.ObjectId(id));

    if (softDelete) {
      // Soft delete by updating status
      return await AlertEventModel.updateMany(
        { _id: { $in: objectIds } },
        {
          status: "resolved",
          updatedAt: new Date(),
          "metadata.deleted": true,
          "metadata.deletedAt": new Date(),
        }
      );
    } else {
      // Hard delete
      return await AlertEventModel.deleteMany({ _id: { $in: objectIds } });
    }
  }

   /**
   * Get distinct values for filtering
   */
   static async getDistinctValues(projectId: string, field: string) {
    return await AlertEventModel.distinct(field, { 
      projectId: new Types.ObjectId(projectId) 
    });
  }

  /**
   * Auto-resolve old alerts
   */
  static async autoResolveOldAlerts(olderThanDays = 30) {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    
    const result = await AlertEventModel.updateMany(
      {
        status: { $in: ['active', 'snoozed'] },
        triggeredAt: { $lte: cutoffDate }
      },
      {
        status: 'resolved',
        updatedAt: new Date(),
        'metadata.autoResolved': true,
        'metadata.autoResolvedReason': `Auto-resolved after ${olderThanDays} days`
      }
    );

    console.log(`Auto-resolved ${result.modifiedCount} old alerts`);
    return result;
  }



  // === PRIVATE HELPER METHODS ===
  /**
   * Check if this would be a duplicate alert to prevent spam
   */
  private static async isDuplicateAlert(
    projectId: Types.ObjectId, 
    ruleId: Types.ObjectId, 
    log: ILog,
    intervalMinutes = 5
  ): Promise<boolean> {
    const since = new Date(Date.now() - intervalMinutes * 60 * 1000);
    
    const existingAlert = await AlertEventModel.findOne({
      projectId,
      ruleId,
      status: { $in: ['active', 'acknowledged'] },
      triggeredAt: { $gte: since },
    });

    return !!existingAlert;
  }

  /**
   * Determine alert severity based on log level and rule configuration
   */
  private static determineSeverity(
    logLevel: string, 
    ruleSeverity?: string
  ): "info" | "warning" | "critical" {
    // Rule severity takes precedence if specified
    if (ruleSeverity && ['info', 'warning', 'critical'].includes(ruleSeverity)) {
      return ruleSeverity as "info" | "warning" | "critical";
    }

    // Default mapping from log level to alert severity
    switch (logLevel) {
      case 'fatal':
      case 'error':
        return 'critical';
      case 'warn':
        return 'warning';
      default:
        return 'info';
    }
  }


  /**
   * Send notifications for an alert
   */
  private static async sendNotifications(event: IAlertEvent, rule: any) {
    const cfg = rule.notificationConfig || {};
    const tasks: Promise<any>[] = [];

    if (rule.notifyChannels?.includes("email") && cfg.emails?.length) {
      tasks.push(
        NotificationService.sendEmail(
          cfg.emails, 
          event.title, 
          `${event.message}\n\nTriggered at: ${event.triggeredAt}\nSeverity: ${event.severity}\n\nLog: ${event.metadata?.log?.message || 'N/A'}`
        )
      );
    }

    if (rule.notifyChannels?.includes("slack") && cfg.slackWebhookUrl) {
      const slackMessage = {
        text: `🚨 ${event.title}`,
        attachments: [{
          color: event.severity === 'critical' ? 'danger' : event.severity === 'warning' ? 'warning' : 'good',
          fields: [
            { title: 'Severity', value: event.severity.toUpperCase(), short: true },
            { title: 'Status', value: event.status, short: true },
            { title: 'Message', value: event.message, short: false },
            { title: 'Environment', value: event.environment || 'N/A', short: true }
          ]
        }]
      };
      tasks.push(NotificationService.sendSlack(cfg.slackWebhookUrl, slackMessage));
    }

    if (rule.notifyChannels?.includes("webhook") && cfg.webhookUrl) {
      tasks.push(NotificationService.sendWebhook(cfg.webhookUrl, { 
        event: event.toObject(),
        type: 'alert.triggered'
      }));
    }

    // Execute all notifications concurrently
    const results = await Promise.allSettled(tasks);
    
    // Log any notification failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Notification failed for channel ${rule.notifyChannels[index]}:`, result.reason);
      }
    });
  }

  /**
   * Broadcast alert via WebSocket
   */
  private static broadcastAlert(
    projectId: Types.ObjectId, 
    event: IAlertEvent, 
    eventType = 'NEW_ALERT'
  ) {
    if (globalServices.dashboardWebSocketService) {
      globalServices.dashboardWebSocketService.broadcastToProject(
        String(projectId), 
        eventType, 
        { alert: event.toObject() }
      );
    }
  }
}
