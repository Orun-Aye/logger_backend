"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertService = void 0;
// @ts-nocheck
const mongoose_1 = require("mongoose");
const alertRule_model_1 = require("../models/alertRule.model");
const alertEvent_model_1 = require("../models/alertEvent.model");
const log_model_1 = require("../models/log.model");
const project_model_1 = require("../models/project.model");
const notification_service_1 = require("./notification.service");
const server_1 = require("../server");
class AlertService {
    static async evaluateLogAndTrigger(log) {
        try {
            const projectId = new mongoose_1.Types.ObjectId(log.projectId);
            const activeRules = await alertRule_model_1.AlertRuleModel.find({
                projectId,
                isActive: true,
            }).lean();
            if (!activeRules.length)
                return;
            for (const rule of activeRules) {
                const condition = rule.condition || {};
                const matchLevel = !condition.level || log.level === condition.level;
                const matchKeyword = !condition.keyword ||
                    (log.message || "")
                        .toLowerCase()
                        .includes(String(condition.keyword).toLowerCase());
                if (!(matchLevel && matchKeyword))
                    continue;
                // Frequency threshold within time window
                if (condition.frequency && condition.intervalMinutes) {
                    const since = new Date(Date.now() - condition.intervalMinutes * 60 * 1000).toISOString();
                    const keywordFilter = condition.keyword
                        ? { message: { $regex: condition.keyword, $options: "i" } }
                        : {};
                    const count = await log_model_1.LogModel.countDocuments({
                        projectId: log.projectId,
                        level: condition.level || log.level,
                        timestamp: { $gte: since },
                        ...keywordFilter,
                    });
                    if (count < condition.frequency)
                        continue;
                }
                // Check for duplicate alerts to prevent spam
                const isDuplicate = await this.isDuplicateAlert(projectId, rule._id, log);
                if (isDuplicate)
                    continue;
                const severity = log.level === "error" || log.level === "fatal"
                    ? "critical"
                    : log.level === "warn"
                        ? "warning"
                        : "info";
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
    /**
     * Get alerts with filtering, sorting, and pagination
     */
    static async getAlerts(filters = {}) {
        const { projectId, severity, status, ruleId, startDate, endDate, tags, limit = 50, offset = 0, userId, } = filters;
        const query = {};
        // Project scoping
        if (projectId) {
            query.projectId = new mongoose_1.Types.ObjectId(projectId);
        }
        else if (userId) {
            // user-scoped: find all accessible projects for this user
            const projects = await project_model_1.ProjectModel.find({
                $or: [
                    { ownerId: new mongoose_1.Types.ObjectId(userId) },
                    { "teamMembers.user": new mongoose_1.Types.ObjectId(userId) },
                ],
                isActive: true,
            }).select({ _id: 1 });
            const accessibleProjectIds = projects.map((p) => p._id);
            if (accessibleProjectIds.length === 0) {
                return { alerts: [], total: 0, limit, offset };
            }
            query.projectId = { $in: accessibleProjectIds };
        }
        if (severity)
            query.severity = severity;
        if (status)
            query.status = status;
        if (ruleId)
            query.ruleId = new mongoose_1.Types.ObjectId(ruleId);
        if (tags?.length)
            query.tags = { $in: tags };
        if (startDate || endDate) {
            query.triggeredAt = {};
            if (startDate)
                query.triggeredAt.$gte = new Date(startDate);
            if (endDate)
                query.triggeredAt.$lte = new Date(endDate);
        }
        const [alerts, total] = await Promise.all([
            alertEvent_model_1.AlertEventModel.find(query)
                .populate("ruleId", "name description")
                .populate("logId", "message level service timestamp")
                .sort({ triggeredAt: -1 })
                .limit(limit)
                .skip(offset)
                .lean(),
            alertEvent_model_1.AlertEventModel.countDocuments(query),
        ]);
        return { alerts, total, limit, offset };
    }
    /**
     * Get alert statistics for dashboard
     */
    static async getAlertStats(args) {
        const { projectId, userId } = args || {};
        const now = new Date();
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        let matchStage = {};
        if (projectId) {
            matchStage.projectId = new mongoose_1.Types.ObjectId(projectId);
        }
        else if (userId) {
            const projects = await project_model_1.ProjectModel.find({
                $or: [
                    { ownerId: new mongoose_1.Types.ObjectId(userId) },
                    { "teamMembers.user": new mongoose_1.Types.ObjectId(userId) },
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
            alertEvent_model_1.AlertEventModel.aggregate([
                { $match: matchStage },
                { $group: { _id: "$status", count: { $sum: 1 } } },
            ]),
            // Severity breakdown
            alertEvent_model_1.AlertEventModel.aggregate([
                { $match: matchStage },
                { $group: { _id: "$severity", count: { $sum: 1 } } },
            ]),
            // Time range breakdown
            Promise.all([
                alertEvent_model_1.AlertEventModel.countDocuments({
                    ...matchStage,
                    triggeredAt: { $gte: last24h },
                }),
                alertEvent_model_1.AlertEventModel.countDocuments({
                    ...matchStage,
                    triggeredAt: { $gte: last7d },
                }),
                alertEvent_model_1.AlertEventModel.countDocuments({
                    ...matchStage,
                    triggeredAt: { $gte: last30d },
                }),
            ]),
        ]);
        // Process results
        const statusMap = statusStats.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }, {});
        const severityMap = severityStats.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }, {});
        const total = Object.values(statusMap).reduce((sum, count) => sum + count, 0);
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
    static async updateAlertStatus(alertId, status, userId) {
        const updateData = {
            status,
            updatedAt: new Date(),
        };
        if (status === "acknowledged") {
            updateData.acknowledgedAt = new Date();
        }
        if (userId) {
            updateData.$push = {
                "metadata.statusHistory": {
                    status,
                    userId,
                    timestamp: new Date(),
                },
            };
        }
        const alert = await alertEvent_model_1.AlertEventModel.findByIdAndUpdate(alertId, updateData, {
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
    static async bulkUpdateAlerts(alertIds, status, userId) {
        const objectIds = alertIds.map((id) => new mongoose_1.Types.ObjectId(id));
        const updateData = {
            status,
            updatedAt: new Date(),
        };
        if (status === "acknowledged") {
            updateData.acknowledgedAt = new Date();
        }
        const result = await alertEvent_model_1.AlertEventModel.updateMany({ _id: { $in: objectIds } }, updateData);
        return result;
    }
    /**
     * Delete alerts (with optional soft delete)
     */
    static async deleteAlerts(alertIds, softDelete = true) {
        const objectIds = alertIds.map((id) => new mongoose_1.Types.ObjectId(id));
        if (softDelete) {
            // Soft delete by updating status
            return await alertEvent_model_1.AlertEventModel.updateMany({ _id: { $in: objectIds } }, {
                status: "resolved",
                updatedAt: new Date(),
                "metadata.deleted": true,
                "metadata.deletedAt": new Date(),
            });
        }
        else {
            // Hard delete
            return await alertEvent_model_1.AlertEventModel.deleteMany({ _id: { $in: objectIds } });
        }
    }
    /**
    * Get distinct values for filtering
    */
    static async getDistinctValues(projectId, field) {
        return await alertEvent_model_1.AlertEventModel.distinct(field, {
            projectId: new mongoose_1.Types.ObjectId(projectId)
        });
    }
    /**
     * Auto-resolve old alerts
     */
    static async autoResolveOldAlerts(olderThanDays = 30) {
        const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
        const result = await alertEvent_model_1.AlertEventModel.updateMany({
            status: { $in: ['active', 'snoozed'] },
            triggeredAt: { $lte: cutoffDate }
        }, {
            status: 'resolved',
            updatedAt: new Date(),
            'metadata.autoResolved': true,
            'metadata.autoResolvedReason': `Auto-resolved after ${olderThanDays} days`
        });
        console.log(`Auto-resolved ${result.modifiedCount} old alerts`);
        return result;
    }
    // === PRIVATE HELPER METHODS ===
    /**
     * Check if this would be a duplicate alert to prevent spam
     */
    static async isDuplicateAlert(projectId, ruleId, log, intervalMinutes = 5) {
        const since = new Date(Date.now() - intervalMinutes * 60 * 1000);
        const existingAlert = await alertEvent_model_1.AlertEventModel.findOne({
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
    static determineSeverity(logLevel, ruleSeverity) {
        // Rule severity takes precedence if specified
        if (ruleSeverity && ['info', 'warning', 'critical'].includes(ruleSeverity)) {
            return ruleSeverity;
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
    static async sendNotifications(event, rule) {
        const cfg = rule.notificationConfig || {};
        const tasks = [];
        if (rule.notifyChannels?.includes("email") && cfg.emails?.length) {
            tasks.push(notification_service_1.NotificationService.sendEmail(cfg.emails, event.title, `${event.message}\n\nTriggered at: ${event.triggeredAt}\nSeverity: ${event.severity}\n\nLog: ${event.metadata?.log?.message || 'N/A'}`));
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
            tasks.push(notification_service_1.NotificationService.sendSlack(cfg.slackWebhookUrl, slackMessage));
        }
        if (rule.notifyChannels?.includes("webhook") && cfg.webhookUrl) {
            tasks.push(notification_service_1.NotificationService.sendWebhook(cfg.webhookUrl, {
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
    static broadcastAlert(projectId, event, eventType = 'NEW_ALERT') {
        if (server_1.globalServices.dashboardWebSocketService) {
            server_1.globalServices.dashboardWebSocketService.broadcastToProject(String(projectId), eventType, { alert: event.toObject() });
        }
    }
}
exports.AlertService = AlertService;
