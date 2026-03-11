"use strict";
// src/validators/alert.validator.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertDistinctFieldParamSchema = exports.alertIdParamSchema = exports.acknowledgeAlertSchema = exports.autoResolveAlertsSchema = exports.alertQuerySchema = exports.deleteAlertsQuerySchema = exports.bulkUpdateAlertsSchema = exports.updateAlertStatusSchema = exports.alertProjectIdParamSchema = exports.alertRuleIdParamSchema = exports.updateAlertRuleSchema = exports.createAlertRuleSchema = void 0;
const zod_1 = require("zod");
/**
 * MongoDB ObjectId regex pattern
 */
const objectIdRegex = /^[0-9a-fA-F]{24}$/;
/**
 * Notification channel enum
 */
const notifyChannelSchema = zod_1.z.enum(["email", "slack", "webhook", "github"]);
/**
 * Alert condition schema
 */
const alertConditionSchema = zod_1.z.object({
    level: zod_1.z.string().min(1, "Condition level is required"),
    keyword: zod_1.z.string().min(1, "Keyword is required"),
    frequency: zod_1.z.number().int().positive().optional(),
    intervalMinutes: zod_1.z.number().int().positive().min(1).max(1440), // Max 24 hours
});
/**
 * Notification config schema
 */
const notificationConfigSchema = zod_1.z
    .object({
    email: zod_1.z
        .object({
        recipients: zod_1.z.array(zod_1.z.string().email()).min(1).optional(),
    })
        .optional(),
    slack: zod_1.z
        .object({
        webhookUrl: zod_1.z.string().url().optional(),
    })
        .optional(),
    webhook: zod_1.z
        .object({
        url: zod_1.z.string().url(),
        method: zod_1.z.enum(["POST", "PUT"]).optional().default("POST"),
        headers: zod_1.z.record(zod_1.z.string()).optional(),
    })
        .optional(),
})
    .optional();
/**
 * Schema for creating an alert rule
 */
exports.createAlertRuleSchema = zod_1.z.object({
    name: zod_1.z
        .string()
        .min(1, "Alert name is required")
        .max(100, "Alert name is too long")
        .trim(),
    projectId: zod_1.z
        .string()
        .regex(objectIdRegex, "Invalid project ID format")
        .or(zod_1.z.any()), // Allow Mongoose ObjectId
    condition: alertConditionSchema,
    isActive: zod_1.z.boolean().optional().default(true),
    notifyChannels: zod_1.z.array(notifyChannelSchema).optional(),
    notificationConfig: notificationConfigSchema,
});
/**
 * Schema for updating an alert rule
 */
exports.updateAlertRuleSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).trim().optional(),
    projectId: zod_1.z
        .string()
        .regex(objectIdRegex, "Invalid project ID format")
        .or(zod_1.z.any())
        .optional(),
    condition: alertConditionSchema.optional(),
    isActive: zod_1.z.boolean().optional(),
    notifyChannels: zod_1.z.array(notifyChannelSchema).optional(),
    notificationConfig: notificationConfigSchema,
});
/**
 * Schema for alert rule ID param
 */
exports.alertRuleIdParamSchema = zod_1.z.object({
    id: zod_1.z.string().regex(objectIdRegex, "Invalid alert rule ID format"),
});
/**
 * Schema for project ID param (for alert routes)
 */
exports.alertProjectIdParamSchema = zod_1.z.object({
    projectId: zod_1.z.string().regex(objectIdRegex, "Invalid project ID format"),
});
/**
 * Alert severity enum
 */
const alertSeveritySchema = zod_1.z.enum(["low", "medium", "high", "critical"]);
/**
 * Alert status enum
 */
const alertStatusSchema = zod_1.z.enum(["active", "acknowledged", "resolved"]);
/**
 * Schema for updating alert status
 */
exports.updateAlertStatusSchema = zod_1.z.object({
    status: alertStatusSchema,
    notes: zod_1.z.string().max(500).optional(),
});
/**
 * Schema for bulk updating alerts
 */
exports.bulkUpdateAlertsSchema = zod_1.z.object({
    alertIds: zod_1.z
        .array(zod_1.z.string().regex(objectIdRegex, "Invalid alert ID format"))
        .min(1, "At least one alert ID is required")
        .max(100, "Too many alerts selected"),
    updates: zod_1.z.object({
        status: alertStatusSchema.optional(),
        notes: zod_1.z.string().max(500).optional(),
    }),
});
/**
 * Schema for deleting alerts (query params)
 */
exports.deleteAlertsQuerySchema = zod_1.z.object({
    projectId: zod_1.z.string().regex(objectIdRegex).optional(),
    status: alertStatusSchema.optional(),
    severity: alertSeveritySchema.optional(),
    startDate: zod_1.z
        .string()
        .optional()
        .transform((val) => (val ? new Date(val) : undefined)),
    endDate: zod_1.z
        .string()
        .optional()
        .transform((val) => (val ? new Date(val) : undefined)),
});
/**
 * Schema for alert query params
 */
exports.alertQuerySchema = zod_1.z.object({
    status: alertStatusSchema.optional(),
    severity: alertSeveritySchema.optional(),
    startDate: zod_1.z
        .string()
        .optional()
        .transform((val) => (val ? new Date(val) : undefined)),
    endDate: zod_1.z
        .string()
        .optional()
        .transform((val) => (val ? new Date(val) : undefined)),
    page: zod_1.z
        .string()
        .optional()
        .transform((val) => (val ? Math.max(1, parseInt(val)) : 1)),
    limit: zod_1.z
        .string()
        .optional()
        .transform((val) => {
        if (!val)
            return 20;
        const parsed = parseInt(val);
        return Math.min(100, Math.max(1, parsed));
    }),
});
/**
 * Schema for auto-resolve old alerts
 */
exports.autoResolveAlertsSchema = zod_1.z.object({
    daysOld: zod_1.z
        .number()
        .int()
        .positive()
        .min(1)
        .max(365)
        .or(zod_1.z
        .string()
        .transform((val) => parseInt(val))
        .pipe(zod_1.z.number().int().positive().min(1).max(365))),
});
/**
 * Schema for acknowledging an alert
 */
exports.acknowledgeAlertSchema = zod_1.z.object({
    notes: zod_1.z.string().max(500).optional(),
});
/**
 * Schema for alert ID param
 */
exports.alertIdParamSchema = zod_1.z.object({
    alertId: zod_1.z.string().regex(objectIdRegex, "Invalid alert ID format"),
});
/**
 * Schema for distinct field param
 */
exports.alertDistinctFieldParamSchema = zod_1.z.object({
    field: zod_1.z.enum(["severity", "status", "ruleId"]),
});
