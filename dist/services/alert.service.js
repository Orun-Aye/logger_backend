"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertService = void 0;
const mongoose_1 = require("mongoose");
const alertRule_model_1 = require("../models/alertRule.model");
const alertEvent_model_1 = require("../models/alertEvent.model");
const log_model_1 = require("../models/log.model");
const project_model_1 = require("../models/project.model");
const maintenanceWindow_model_1 = require("../models/maintenanceWindow.model");
const escalationPolicy_model_1 = require("../models/escalationPolicy.model");
const notification_service_1 = require("./notification.service");
const integration_manager_1 = require("./integrations/integration.manager");
const server_1 = require("../server");
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
class AlertService {
    static async evaluateLogAndTrigger(log) {
        try {
            const projectId = new mongoose_1.Types.ObjectId(log.projectId);
            // Check maintenance windows first
            const inMaintenanceWindow = await this.checkMaintenanceWindow(projectId, log);
            if (inMaintenanceWindow) {
                console.log(`Alert suppressed due to maintenance window for project ${projectId}`);
                return;
            }
            const activeRules = await alertRule_model_1.AlertRuleModel.find({
                projectId,
                isActive: true,
            }).lean();
            if (!activeRules.length)
                return;
            for (const rule of activeRules) {
                // Check if rule is snoozed
                if (rule.snoozeUntil && rule.snoozeUntil > new Date()) {
                    continue;
                }
                const condition = rule.condition;
                let matched = false;
                // Check if it's a composite condition
                if ('operator' in condition) {
                    matched = this.evaluateCompositeCondition(condition, log);
                }
                else {
                    matched = this.evaluateSimpleCondition(condition, log);
                }
                if (!matched)
                    continue;
                // Frequency threshold check (if specified)
                const freq = ('frequency' in condition) ? condition.frequency : undefined;
                const interval = ('intervalMinutes' in condition) ? (condition.intervalMinutes ?? 10) : undefined;
                if (freq && freq > 1 && interval) {
                    const since = new Date(Date.now() - interval * 60 * 1000).toISOString();
                    // Build a query that mirrors the rule condition (not just log level)
                    const conditionQuery = {
                        projectId: log.projectId,
                        timestamp: { $gte: since },
                    };
                    const simple = ('operator' in condition)
                        ? condition.conditions[0]
                        : condition;
                    if (simple.level)
                        conditionQuery.level = simple.level;
                    if (simple.keyword)
                        conditionQuery.message = { $regex: simple.keyword, $options: 'i' };
                    if (simple.service)
                        conditionQuery.service = simple.service;
                    if (simple.environment)
                        conditionQuery.environment = simple.environment;
                    if (simple.eventType)
                        conditionQuery.eventType = simple.eventType;
                    const count = await log_model_1.LogModel.countDocuments(conditionQuery);
                    if (count < freq)
                        continue;
                }
                // Use the rule's intervalMinutes as cooldown window for duplicate prevention
                const cooldownMinutes = interval || 10;
                // Check for duplicate alerts to prevent spam
                const isDuplicate = await this.isDuplicateAlert(projectId, rule._id, log, cooldownMinutes);
                if (isDuplicate)
                    continue;
                const severity = this.determineSeverity(log.level);
                const title = `Alert: ${rule.name}`;
                const message = rule.description || `Triggered by ${log.level} log`;
                const event = await alertEvent_model_1.AlertEventModel.create({
                    projectId,
                    ruleId: rule._id,
                    logId: log._id,
                    title,
                    message,
                    severity,
                    notifyChannels: rule.notifyChannels || [],
                    metadata: { log },
                    environment: log.environment,
                    service: log.service,
                    triggeredAt: new Date(),
                    escalationLevel: rule.escalationPolicyId ? 0 : undefined,
                });
                // Send notifications
                await this.sendNotifications(event, rule);
                // Broadcast via websocket
                this.broadcastAlert(projectId, event, 'NEW_ALERT');
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
    static async updateAlertStatus(alertId, status, userId, resolutionNotes, snoozeDurationMinutes) {
        const updateData = {
            $set: {
                status,
                updatedAt: new Date(),
            },
        };
        // Status-specific fields
        if (status === "acknowledged") {
            updateData.$set.acknowledgedAt = new Date();
            if (userId)
                updateData.$set.acknowledgedBy = new mongoose_1.Types.ObjectId(userId);
        }
        else if (status === "resolved") {
            updateData.$set.resolvedAt = new Date();
            if (userId)
                updateData.$set.resolvedBy = new mongoose_1.Types.ObjectId(userId);
            if (resolutionNotes)
                updateData.$set.resolutionNotes = resolutionNotes;
        }
        else if (status === "snoozed" && snoozeDurationMinutes) {
            const snoozedUntil = new Date(Date.now() + snoozeDurationMinutes * 60 * 1000);
            updateData.$set.snoozedUntil = snoozedUntil;
            if (userId)
                updateData.$set.snoozedBy = new mongoose_1.Types.ObjectId(userId);
        }
        // Add to status history
        if (userId) {
            updateData.$push = {
                "metadata.statusHistory": {
                    status,
                    userId,
                    timestamp: new Date(),
                    notes: resolutionNotes,
                },
            };
        }
        const alert = await alertEvent_model_1.AlertEventModel.findByIdAndUpdate(alertId, updateData, {
            new: true,
        })
            .populate("ruleId", "name description")
            .populate("logId", "message level service timestamp")
            .populate("acknowledgedBy", "name email")
            .populate("resolvedBy", "name email");
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
        if (rule.notifyChannels?.includes("github")) {
            tasks.push(this.createGitHubIssueFromAlert(event, rule));
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
     * Create a GitHub issue from an alert event via the GitHub integration.
     * Includes 24-hour deduplication to prevent duplicate issues for the same alert.
     */
    static async createGitHubIssueFromAlert(alertEvent, rule) {
        try {
            const projectId = rule.projectId.toString();
            // Deduplication: check for existing alert with same fingerprint in last 24h
            const fingerprint = `${rule._id}-${alertEvent.message}`;
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const existing = await alertEvent_model_1.AlertEventModel.findOne({
                projectId: rule.projectId,
                'metadata.githubFingerprint': fingerprint,
                createdAt: { $gte: twentyFourHoursAgo },
                'metadata.githubIssueUrl': { $exists: true },
            });
            if (existing) {
                return; // Skip duplicate
            }
            // Format issue body
            const severity = alertEvent.severity || 'warning';
            const environment = alertEvent.environment || 'unknown';
            const title = `[Apperio Alert] ${rule.name}: ${alertEvent.message || 'Alert triggered'}`;
            const body = [
                `## Alert Details`,
                ``,
                `| Field | Value |`,
                `|-------|-------|`,
                `| **Rule** | ${rule.name} |`,
                `| **Severity** | ${severity} |`,
                `| **Environment** | ${environment} |`,
                `| **Triggered** | ${new Date().toISOString()} |`,
                ``,
                `### Message`,
                `${alertEvent.message || 'No message'}`,
                alertEvent.metadata?.log?.error?.stack
                    ? `\n### Stack Trace\n\`\`\`\n${alertEvent.metadata.log.error.stack}\n\`\`\``
                    : '',
                ``,
                `---`,
                `*Auto-generated by Apperio Alert System*`,
            ].join('\n');
            const labels = ['apperio-alert', `severity:${severity}`, `env:${environment}`];
            const result = await integration_manager_1.integrationManager.executeActionForProject(projectId, 'github', 'create_issue', { title, body, labels });
            // Record the GitHub issue URL on the alert event for tracking
            if (result.success && result.result?.issueUrl) {
                await alertEvent_model_1.AlertEventModel.findByIdAndUpdate(alertEvent._id, {
                    $set: {
                        'metadata.githubIssueUrl': result.result.issueUrl,
                        'metadata.githubFingerprint': fingerprint,
                    },
                });
            }
        }
        catch (error) {
            console.error('Failed to create GitHub issue from alert:', error.message);
        }
    }
    /**
     * Broadcast alert via WebSocket
     */
    static broadcastAlert(projectId, event, eventType = 'NEW_ALERT') {
        if (server_1.globalServices.dashboardWebSocketService) {
            server_1.globalServices.dashboardWebSocketService.broadcastToProject(String(projectId), eventType, { alert: event.toObject() });
        }
    }
    // === PHASE 2.2 ENHANCEMENTS ===
    /**
     * Check if there's an active maintenance window that should suppress this alert
     */
    static async checkMaintenanceWindow(projectId, log) {
        const activeWindows = await maintenanceWindow_model_1.MaintenanceWindowModel.findActiveWindows(projectId);
        if (activeWindows.length === 0)
            return false;
        for (const window of activeWindows) {
            // Check if window suppresses all alerts
            if (window.suppressAllAlerts)
                return true;
            // Check service filter
            if (window.affectedServices?.length && log.service) {
                if (window.affectedServices.includes(log.service))
                    return true;
            }
            // Check environment filter
            if (window.affectedEnvironments?.length && log.environment) {
                if (window.affectedEnvironments.includes(log.environment))
                    return true;
            }
        }
        return false;
    }
    /**
     * Evaluate a simple condition against a log
     */
    static evaluateSimpleCondition(condition, log) {
        // Level match
        if (condition.level && log.level !== condition.level)
            return false;
        // Keyword match
        if (condition.keyword) {
            const message = (log.message || '').toLowerCase();
            if (!message.includes(condition.keyword.toLowerCase()))
                return false;
        }
        // Service match
        if (condition.service && log.service !== condition.service)
            return false;
        // Environment match
        if (condition.environment && log.environment !== condition.environment)
            return false;
        // Response time threshold (use client-reported network duration)
        if (condition.responseTimeThreshold) {
            const clientDuration = log.data?.network?.duration;
            if (clientDuration != null && clientDuration < condition.responseTimeThreshold)
                return false;
        }
        // Event type match
        if (condition.eventType && log.eventType !== condition.eventType)
            return false;
        return true;
    }
    /**
     * Evaluate a composite condition (AND/OR logic) against a log
     */
    static evaluateCompositeCondition(condition, log) {
        const { operator, conditions } = condition;
        if (operator === 'AND') {
            return conditions.every((c) => this.evaluateSimpleCondition(c, log));
        }
        else {
            // OR logic
            return conditions.some((c) => this.evaluateSimpleCondition(c, log));
        }
    }
    /**
     * Test an alert rule against recent logs (dry-run)
     */
    static async testAlertRule(ruleId, limitLogs = 100) {
        const rule = await alertRule_model_1.AlertRuleModel.findById(ruleId);
        if (!rule)
            throw new Error('Alert rule not found');
        // Get recent logs for this project
        const recentLogs = await log_model_1.LogModel.find({ projectId: rule.projectId })
            .sort({ timestamp: -1 })
            .limit(limitLogs)
            .lean();
        const matchedLogs = [];
        const condition = rule.condition;
        for (const log of recentLogs) {
            let matched = false;
            // Check if it's a composite condition
            if ('operator' in condition) {
                matched = this.evaluateCompositeCondition(condition, log);
            }
            else {
                matched = this.evaluateSimpleCondition(condition, log);
            }
            if (matched)
                matchedLogs.push(log);
        }
        return {
            matched: matchedLogs.length,
            logs: matchedLogs.slice(0, 10), // Return first 10 for preview
        };
    }
    /**
     * Get alert analytics (frequency trends, MTTR, noisiest rules)
     */
    static async getAlertAnalytics(projectId, timeRange = '7d') {
        const daysMap = {
            '1d': 1,
            '7d': 7,
            '30d': 30,
        };
        const days = daysMap[timeRange] || 7;
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const projectObjectId = new mongoose_1.Types.ObjectId(projectId);
        // Frequency trends (alerts per day)
        const frequencyTrends = await alertEvent_model_1.AlertEventModel.aggregate([
            {
                $match: {
                    projectId: projectObjectId,
                    triggeredAt: { $gte: startDate },
                },
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$triggeredAt' },
                    },
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]);
        // Noisiest rules (rules triggering most alerts)
        const noisiestRules = await alertEvent_model_1.AlertEventModel.aggregate([
            {
                $match: {
                    projectId: projectObjectId,
                    triggeredAt: { $gte: startDate },
                    ruleId: { $exists: true },
                },
            },
            {
                $group: {
                    _id: '$ruleId',
                    count: { $sum: 1 },
                    lastTriggered: { $max: '$triggeredAt' },
                },
            },
            { $sort: { count: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'alertrules',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'rule',
                },
            },
            { $unwind: '$rule' },
            {
                $project: {
                    ruleId: '$_id',
                    ruleName: '$rule.name',
                    count: 1,
                    lastTriggered: 1,
                },
            },
        ]);
        // Mean Time To Resolution (MTTR)
        const mttrData = await alertEvent_model_1.AlertEventModel.aggregate([
            {
                $match: {
                    projectId: projectObjectId,
                    status: 'resolved',
                    resolvedAt: { $exists: true },
                    triggeredAt: { $gte: startDate },
                },
            },
            {
                $project: {
                    resolutionTime: {
                        $subtract: ['$resolvedAt', '$triggeredAt'],
                    },
                },
            },
            {
                $group: {
                    _id: null,
                    avgMTTR: { $avg: '$resolutionTime' },
                    minMTTR: { $min: '$resolutionTime' },
                    maxMTTR: { $max: '$resolutionTime' },
                    count: { $sum: 1 },
                },
            },
        ]);
        const mttr = mttrData.length > 0
            ? {
                avgMinutes: Math.round((mttrData[0].avgMTTR || 0) / (1000 * 60)),
                minMinutes: Math.round((mttrData[0].minMTTR || 0) / (1000 * 60)),
                maxMinutes: Math.round((mttrData[0].maxMTTR || 0) / (1000 * 60)),
                resolvedCount: mttrData[0].count,
            }
            : { avgMinutes: 0, minMinutes: 0, maxMinutes: 0, resolvedCount: 0 };
        // Severity distribution over time
        const severityDistribution = await alertEvent_model_1.AlertEventModel.aggregate([
            {
                $match: {
                    projectId: projectObjectId,
                    triggeredAt: { $gte: startDate },
                },
            },
            {
                $group: {
                    _id: '$severity',
                    count: { $sum: 1 },
                },
            },
        ]);
        return {
            frequencyTrends,
            noisiestRules,
            mttr,
            severityDistribution,
            timeRange,
        };
    }
    /**
     * Get alert timeline for incident tracking
     */
    static async getAlertTimeline(projectId, startDate, endDate) {
        const timeline = await alertEvent_model_1.AlertEventModel.find({
            projectId: new mongoose_1.Types.ObjectId(projectId),
            triggeredAt: { $gte: startDate, $lte: endDate },
        })
            .sort({ triggeredAt: 1 })
            .populate('ruleId', 'name')
            .populate('logId', 'message level service')
            .populate('acknowledgedBy', 'name email')
            .populate('resolvedBy', 'name email')
            .lean();
        // Group by severity and status for summary
        const summary = {
            total: timeline.length,
            bySeverity: {
                info: timeline.filter((a) => a.severity === 'info').length,
                warning: timeline.filter((a) => a.severity === 'warning').length,
                critical: timeline.filter((a) => a.severity === 'critical').length,
            },
            byStatus: {
                active: timeline.filter((a) => a.status === 'active').length,
                acknowledged: timeline.filter((a) => a.status === 'acknowledged').length,
                resolved: timeline.filter((a) => a.status === 'resolved').length,
                snoozed: timeline.filter((a) => a.status === 'snoozed').length,
            },
        };
        return { timeline, summary };
    }
    /**
     * Process escalation for unacknowledged alerts
     * (Called by a background job periodically)
     */
    static async processEscalations() {
        // Find alerts that have escalation policies and are still active
        const alertsWithEscalation = await alertEvent_model_1.AlertEventModel.aggregate([
            {
                $match: {
                    status: 'active',
                    escalationLevel: { $exists: true },
                },
            },
            {
                $lookup: {
                    from: 'alertrules',
                    localField: 'ruleId',
                    foreignField: '_id',
                    as: 'rule',
                },
            },
            { $unwind: '$rule' },
            {
                $match: {
                    'rule.escalationPolicyId': { $exists: true, $ne: null },
                },
            },
        ]);
        for (const alert of alertsWithEscalation) {
            const rule = alert.rule;
            const policy = await escalationPolicy_model_1.EscalationPolicyModel.findById(rule.escalationPolicyId);
            if (!policy || !policy.isActive)
                continue;
            const currentLevel = alert.escalationLevel || 0;
            const nextLevel = policy.levels.find((l) => l.level === currentLevel + 1);
            if (!nextLevel)
                continue; // No more escalation levels
            // Check if enough time has passed for escalation
            const lastEscalatedAt = alert.lastEscalatedAt || alert.triggeredAt;
            const minutesSinceLastEscalation = (Date.now() - new Date(lastEscalatedAt).getTime()) / (1000 * 60);
            if (minutesSinceLastEscalation >= nextLevel.delayMinutes) {
                // Escalate!
                await alertEvent_model_1.AlertEventModel.findByIdAndUpdate(alert._id, {
                    $set: {
                        escalationLevel: nextLevel.level,
                        lastEscalatedAt: new Date(),
                    },
                });
                // Send escalation notifications
                const escalationTitle = `🔺 ESCALATED: ${alert.title} (Level ${nextLevel.level})`;
                const escalationMessage = `Alert has been escalated to level ${nextLevel.level}\n\nOriginal message: ${alert.message}\n\nTriggered at: ${alert.triggeredAt}`;
                const tasks = [];
                if (nextLevel.notifyChannels.includes('email')) {
                    tasks.push(notification_service_1.NotificationService.sendEmail(nextLevel.recipients, escalationTitle, escalationMessage));
                }
                if (nextLevel.notifyChannels.includes('slack') && nextLevel.webhookUrl) {
                    tasks.push(notification_service_1.NotificationService.sendSlack(nextLevel.webhookUrl, {
                        text: escalationTitle,
                        attachments: [
                            {
                                color: 'danger',
                                fields: [
                                    { title: 'Level', value: `${nextLevel.level}`, short: true },
                                    { title: 'Severity', value: alert.severity, short: true },
                                    { title: 'Message', value: escalationMessage, short: false },
                                ],
                            },
                        ],
                    }));
                }
                if (nextLevel.notifyChannels.includes('webhook') && nextLevel.webhookUrl) {
                    tasks.push(notification_service_1.NotificationService.sendWebhook(nextLevel.webhookUrl, {
                        type: 'alert.escalated',
                        alert,
                        escalationLevel: nextLevel.level,
                    }));
                }
                await Promise.allSettled(tasks);
                console.log(`Escalated alert ${alert._id} to level ${nextLevel.level} for project ${alert.projectId}`);
            }
        }
    }
    /**
     * Snooze an alert rule for a specified duration
     */
    static async snoozeAlertRule(ruleId, durationMinutes, userId) {
        const snoozeUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
        const rule = await alertRule_model_1.AlertRuleModel.findByIdAndUpdate(ruleId, {
            $set: { snoozeUntil },
        }, { new: true });
        return rule;
    }
}
exports.AlertService = AlertService;
