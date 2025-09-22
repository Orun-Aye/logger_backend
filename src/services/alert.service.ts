// @ts-nocheck
import { Types } from "mongoose";
import { AlertRuleModel } from "../models/alertRule.model";
import { AlertEventModel } from "../models/alertEvent.model";
import { LogModel, ILog } from "../models/log.model";
import { NotificationService } from "./notification.service";
import { globalServices } from "../server";

type RuleCondition = {
  level?: string;
  keyword?: string;
  frequency?: number;
  intervalMinutes?: number;
};

export class AlertService {
  static async evaluateLogAndTrigger(log: ILog) {
    try {
      const projectId = new Types.ObjectId(log.projectId);
      const activeRules = await AlertRuleModel.find({ projectId, isActive: true }).lean();
      if (!activeRules.length) return;

      for (const rule of activeRules) {
        const condition: RuleCondition = rule.condition || {};
        const matchLevel = !condition.level || log.level === condition.level;
        const matchKeyword = !condition.keyword || (log.message || "").toLowerCase().includes(String(condition.keyword).toLowerCase());
        if (!(matchLevel && matchKeyword)) continue;

        // Frequency threshold within time window
        if (condition.frequency && condition.intervalMinutes) {
          const since = new Date(Date.now() - condition.intervalMinutes * 60 * 1000).toISOString();
          const keywordFilter = condition.keyword ? { message: { $regex: condition.keyword, $options: "i" } } : {};
          const count = await LogModel.countDocuments({
            projectId: log.projectId,
            level: condition.level || log.level,
            timestamp: { $gte: since },
            ...keywordFilter,
          });
          if (count < condition.frequency) continue;
        }

        const severity = log.level === "error" || log.level === "fatal" ? "critical" : log.level === "warn" ? "warning" : "info";
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
          tasks.push(NotificationService.sendEmail(cfg.emails, title, `${message}\n${log.message}`));
        }
        if (rule.notifyChannels?.includes("slack") && cfg.slackWebhookUrl) {
          tasks.push(NotificationService.sendSlack(cfg.slackWebhookUrl, `${title}: ${message}`));
        }
        if (rule.notifyChannels?.includes("webhook") && cfg.webhookUrl) {
          tasks.push(NotificationService.sendWebhook(cfg.webhookUrl, { event }));
        }
        Promise.allSettled(tasks).catch(() => {});

        // Broadcast via websocket
        if (globalServices.dashboardWebSocketService) {
          globalServices.dashboardWebSocketService.broadcastToProject(String(projectId), "NEW_ALERT", { alert: event.toObject() });
        }
      }
    } catch (err) {
      console.error("Alert evaluation failed", err);
    }
  }
}


