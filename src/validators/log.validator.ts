// src/validators/log.validator.ts

import { z } from "zod";

/**
 * Log level enum schema
 */
export const logLevelSchema = z.enum([
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
]);

/**
 * Event type enum schema
 */
export const eventTypeSchema = z.enum([
  "error",
  "performance",
  "interaction",
  "network",
  "console",
  "pageview",
  "web-vital",
  "breadcrumb",
  "message",
  "system",
]);

/**
 * Error object schema
 */
const errorSchema = z
  .object({
    name: z.string(),
    message: z.string(),
    stack: z.string().optional(),
    url: z.string().url().optional().or(z.literal("")),
    lineNumber: z.number().int().positive().optional(),
    columnNumber: z.number().int().positive().optional(),
  })
  .strict();

/**
 * Schema for creating a new log entry
 */
export const createLogSchema = z
  .object({
    projectId: z.string().min(1, "Project ID is required"),
    timestamp: z
      .union([z.date(), z.string().datetime(), z.number()])
      .optional()
      .transform((val) => {
        if (!val) return new Date();
        if (val instanceof Date) return val;
        if (typeof val === "number") return new Date(val);
        return new Date(val);
      }),
    level: logLevelSchema,
    message: z.string().min(1, "Message is required").max(10000, "Message too long"),
    data: z.record(z.any()).optional(),
    error: errorSchema.optional(),
    service: z.string().max(100).optional(),
    environment: z.string().max(50).optional(),
    context: z.record(z.any()).optional(),
    metadata: z.any().optional(),
    eventType: eventTypeSchema.optional(),
    userAgent: z.string().max(500).optional(),
    url: z.string().url().optional().or(z.literal("")),
    referrer: z.string().url().optional().or(z.literal("")),
    ingestionLatency: z.number().min(0).optional(),
    correlationId: z.string().max(100).optional(),
    sessionId: z.string().max(100).optional(),
    traceId: z.string().max(100).optional(),
    spanId: z.string().max(100).optional(),
    release: z.string().max(100).optional(),
  })
  .strict();

/**
 * Schema for filtering logs via query params
 */
export const filterLogsSchema = z.object({
  projectId: z.string().optional(),
  level: logLevelSchema.optional(),
  levels: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",") : undefined))
    .pipe(z.array(logLevelSchema).optional()),
  service: z.string().optional(),
  services: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",") : undefined)),
  environment: z.string().optional(),
  search: z.string().optional(),
  startDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  endDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  eventType: eventTypeSchema.optional(),
  userAgent: z.string().optional(),
  url: z.string().optional(),
  referrer: z.string().optional(),
  errorName: z.string().optional(),
  errorMessage: z.string().optional(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  release: z.string().optional(),
  correlationId: z.string().optional(),
  sessionId: z.string().optional(),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Math.max(1, parseInt(val)) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return 10;
      const parsed = parseInt(val);
      return Math.min(100, Math.max(1, parsed)); // Cap at 100
    }),
  sortBy: z
    .enum([
      "timestamp",
      "level",
      "service",
      "environment",
      "createdAt",
      "updatedAt",
      "eventType",
      "url",
    ])
    .optional()
    .default("timestamp"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

/**
 * Schema for log ID param
 */
export const logIdParamSchema = z.object({
  logId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid log ID format"),
});

/**
 * Schema for project ID param
 */
export const projectIdParamSchema = z.object({
  projectId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid project ID format"),
});

/**
 * Schema for getting distinct values
 */
export const distinctFieldParamSchema = z.object({
  field: z.enum(["service", "environment", "level", "eventType", "userAgent"]),
});

/**
 * Schema for delete logs query params
 */
export const deleteLogsSchema = z
  .object({
    projectId: z.string().optional(),
    level: logLevelSchema.optional(),
    service: z.string().optional(),
    environment: z.string().optional(),
    startDate: z
      .string()
      .optional()
      .transform((val) => (val ? new Date(val) : undefined)),
    endDate: z
      .string()
      .optional()
      .transform((val) => (val ? new Date(val) : undefined)),
    eventType: eventTypeSchema.optional(),
  })
  .refine(
    (data) => {
      // At least one filter must be provided to prevent mass deletion
      return (
        data.level ||
        data.service ||
        data.environment ||
        data.startDate ||
        data.endDate ||
        data.eventType
      );
    },
    {
      message: "At least one filter parameter is required for deletion",
    }
  );

/**
 * Schema for trends query params
 */
export const trendsQuerySchema = z.object({
  startDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  endDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  interval: z.enum(["hour", "day", "week", "month"]).optional().default("hour"),
});

// Type exports for use in controllers
export type CreateLogInput = z.infer<typeof createLogSchema>;
export type FilterLogsInput = z.infer<typeof filterLogsSchema>;
export type DeleteLogsInput = z.infer<typeof deleteLogsSchema>;
export type TrendsQueryInput = z.infer<typeof trendsQuerySchema>;
