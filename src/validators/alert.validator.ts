// src/validators/alert.validator.ts

import { z } from "zod";

/**
 * MongoDB ObjectId regex pattern
 */
const objectIdRegex = /^[0-9a-fA-F]{24}$/;

/**
 * Notification channel enum
 */
const notifyChannelSchema = z.enum(["email", "slack", "webhook"]);

/**
 * Alert condition schema
 */
const alertConditionSchema = z.object({
  level: z.string().min(1, "Condition level is required"),
  keyword: z.string().min(1, "Keyword is required"),
  frequency: z.number().int().positive().optional(),
  intervalMinutes: z.number().int().positive().min(1).max(1440), // Max 24 hours
});

/**
 * Notification config schema
 */
const notificationConfigSchema = z
  .object({
    email: z
      .object({
        recipients: z.array(z.string().email()).min(1).optional(),
      })
      .optional(),
    slack: z
      .object({
        webhookUrl: z.string().url().optional(),
      })
      .optional(),
    webhook: z
      .object({
        url: z.string().url(),
        method: z.enum(["POST", "PUT"]).optional().default("POST"),
        headers: z.record(z.string()).optional(),
      })
      .optional(),
  })
  .optional();

/**
 * Schema for creating an alert rule
 */
export const createAlertRuleSchema = z.object({
  name: z
    .string()
    .min(1, "Alert name is required")
    .max(100, "Alert name is too long")
    .trim(),
  projectId: z
    .string()
    .regex(objectIdRegex, "Invalid project ID format")
    .or(z.any()), // Allow Mongoose ObjectId
  condition: alertConditionSchema,
  isActive: z.boolean().optional().default(true),
  notifyChannels: z.array(notifyChannelSchema).optional(),
  notificationConfig: notificationConfigSchema,
});

/**
 * Schema for updating an alert rule
 */
export const updateAlertRuleSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  projectId: z
    .string()
    .regex(objectIdRegex, "Invalid project ID format")
    .or(z.any())
    .optional(),
  condition: alertConditionSchema.optional(),
  isActive: z.boolean().optional(),
  notifyChannels: z.array(notifyChannelSchema).optional(),
  notificationConfig: notificationConfigSchema,
});

/**
 * Schema for alert rule ID param
 */
export const alertRuleIdParamSchema = z.object({
  id: z.string().regex(objectIdRegex, "Invalid alert rule ID format"),
});

/**
 * Schema for project ID param (for alert routes)
 */
export const alertProjectIdParamSchema = z.object({
  projectId: z.string().regex(objectIdRegex, "Invalid project ID format"),
});

/**
 * Alert severity enum
 */
const alertSeveritySchema = z.enum(["low", "medium", "high", "critical"]);

/**
 * Alert status enum
 */
const alertStatusSchema = z.enum(["active", "acknowledged", "resolved"]);

/**
 * Schema for updating alert status
 */
export const updateAlertStatusSchema = z.object({
  status: alertStatusSchema,
  notes: z.string().max(500).optional(),
});

/**
 * Schema for bulk updating alerts
 */
export const bulkUpdateAlertsSchema = z.object({
  alertIds: z
    .array(z.string().regex(objectIdRegex, "Invalid alert ID format"))
    .min(1, "At least one alert ID is required")
    .max(100, "Too many alerts selected"),
  updates: z.object({
    status: alertStatusSchema.optional(),
    notes: z.string().max(500).optional(),
  }),
});

/**
 * Schema for deleting alerts (query params)
 */
export const deleteAlertsQuerySchema = z.object({
  projectId: z.string().regex(objectIdRegex).optional(),
  status: alertStatusSchema.optional(),
  severity: alertSeveritySchema.optional(),
  startDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  endDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
});

/**
 * Schema for alert query params
 */
export const alertQuerySchema = z.object({
  status: alertStatusSchema.optional(),
  severity: alertSeveritySchema.optional(),
  startDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  endDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Math.max(1, parseInt(val)) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return 20;
      const parsed = parseInt(val);
      return Math.min(100, Math.max(1, parsed));
    }),
});

/**
 * Schema for auto-resolve old alerts
 */
export const autoResolveAlertsSchema = z.object({
  daysOld: z
    .number()
    .int()
    .positive()
    .min(1)
    .max(365)
    .or(
      z
        .string()
        .transform((val) => parseInt(val))
        .pipe(z.number().int().positive().min(1).max(365))
    ),
});

/**
 * Schema for acknowledging an alert
 */
export const acknowledgeAlertSchema = z.object({
  notes: z.string().max(500).optional(),
});

/**
 * Schema for alert ID param
 */
export const alertIdParamSchema = z.object({
  alertId: z.string().regex(objectIdRegex, "Invalid alert ID format"),
});

/**
 * Schema for distinct field param
 */
export const alertDistinctFieldParamSchema = z.object({
  field: z.enum(["severity", "status", "ruleId"]),
});

// Type exports
export type CreateAlertRuleInput = z.infer<typeof createAlertRuleSchema>;
export type UpdateAlertRuleInput = z.infer<typeof updateAlertRuleSchema>;
export type UpdateAlertStatusInput = z.infer<typeof updateAlertStatusSchema>;
export type BulkUpdateAlertsInput = z.infer<typeof bulkUpdateAlertsSchema>;
export type DeleteAlertsQueryInput = z.infer<typeof deleteAlertsQuerySchema>;
export type AlertQueryInput = z.infer<typeof alertQuerySchema>;
export type AutoResolveAlertsInput = z.infer<typeof autoResolveAlertsSchema>;
export type AcknowledgeAlertInput = z.infer<typeof acknowledgeAlertSchema>;
