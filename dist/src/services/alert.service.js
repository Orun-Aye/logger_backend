"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertService = void 0;
// @ts-nocheck
const mongoose_1 = require("mongoose");
const alertRule_model_1 = require("../models/alertRule.model");
const alertEvent_model_1 = require("../models/alertEvent.model");
const log_model_1 = require("../models/log.model");
const notification_service_1 = require("./notification.service");
const server_1 = require("../server");
class AlertService {
    static async evaluateLogAndTrigger(log) {
        try {
            const projectId = new mongoose_1.Types.ObjectId(log.projectId);
            const activeRules = await alertRule_model_1.AlertRuleModel.find({ projectId, isActive: true }).lean();
            if (!activeRules.length)
                return;
            for (const rule of activeRules) {
                const condition = rule.condition || {};
                const matchLevel = !condition.level || log.level === condition.level;
                const matchKeyword = !condition.keyword || (log.message || "").toLowerCase().includes(String(condition.keyword).toLowerCase());
                if (!(matchLevel && matchKeyword))
                    continue;
                // Frequency threshold within time window
                if (condition.frequency && condition.intervalMinutes) {
                    const since = new Date(Date.now() - condition.intervalMinutes * 60 * 1000).toISOString();
                    const keywordFilter = condition.keyword ? { message: { $regex: condition.keyword, $options: "i" } } : {};
                    const count = await log_model_1.LogModel.countDocuments({
                        projectId: log.projectId,
                        level: condition.level || log.level,
                        timestamp: { $gte: since },
                        ...keywordFilter,
                    });
                    if (count < condition.frequency)
                        continue;
                }
                const severity = log.level === "error" || log.level === "fatal" ? "critical" : log.level === "warn" ? "warning" : "info";
                const title = `Alert: ${rule.name}`;
                const message = condition.keyword
                    ? `Matched ${log.level} with keyword "${condition.keyword}"`
                    : `Matched ${log.level} log rule`;
                const event = await alertEvent_model_1.AlertEventModel.create({
                    projectId,
                    ruleId: rule._id,
                    logId: log._id,
                    title,
                    message,
                    severity,
                    notifyChannels: rule.notifyChannels || [],
                    metadata: { log },
                    triggeredAt: new Date(),
                });
                // Dispatch notifications (best-effort)
                const cfg = rule.notificationConfig || {};
                const tasks = [];
                if (rule.notifyChannels?.includes("email") && cfg.emails?.length) {
                    tasks.push(notification_service_1.NotificationService.sendEmail(cfg.emails, title, `${message}\n${log.message}`));
                }
                if (rule.notifyChannels?.includes("slack") && cfg.slackWebhookUrl) {
                    tasks.push(notification_service_1.NotificationService.sendSlack(cfg.slackWebhookUrl, `${title}: ${message}`));
                }
                if (rule.notifyChannels?.includes("webhook") && cfg.webhookUrl) {
                    tasks.push(notification_service_1.NotificationService.sendWebhook(cfg.webhookUrl, { event }));
                }
                Promise.allSettled(tasks).catch(() => { });
                // Broadcast via websocket
                if (server_1.globalServices.dashboardWebSocketService) {
                    server_1.globalServices.dashboardWebSocketService.broadcastToProject(String(projectId), "NEW_ALERT", { alert: event.toObject() });
                }
            }
        }
        catch (err) {
            console.error("Alert evaluation failed", err);
        }
    }
}
exports.AlertService = AlertService;
