"use strict";
// src/validators/log.validator.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.trendsQuerySchema = exports.deleteLogsSchema = exports.distinctFieldParamSchema = exports.projectIdParamSchema = exports.logIdParamSchema = exports.filterLogsSchema = exports.createLogSchema = exports.eventTypeSchema = exports.logLevelSchema = void 0;
const zod_1 = require("zod");
/**
 * Log level enum schema
 */
exports.logLevelSchema = zod_1.z.enum([
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
exports.eventTypeSchema = zod_1.z.enum([
    "error",
    "performance",
    "interaction",
    "network",
    "console",
    "pageview",
]);
/**
 * Error object schema
 */
const errorSchema = zod_1.z
    .object({
    name: zod_1.z.string(),
    message: zod_1.z.string(),
    stack: zod_1.z.string().optional(),
    url: zod_1.z.string().url().optional().or(zod_1.z.literal("")),
    lineNumber: zod_1.z.number().int().positive().optional(),
    columnNumber: zod_1.z.number().int().positive().optional(),
})
    .strict();
/**
 * Schema for creating a new log entry
 */
exports.createLogSchema = zod_1.z
    .object({
    projectId: zod_1.z.string().min(1, "Project ID is required"),
    timestamp: zod_1.z
        .union([zod_1.z.date(), zod_1.z.string().datetime(), zod_1.z.number()])
        .optional()
        .transform((val) => {
        if (!val)
            return new Date();
        if (val instanceof Date)
            return val;
        if (typeof val === "number")
            return new Date(val);
        return new Date(val);
    }),
    level: exports.logLevelSchema,
    message: zod_1.z.string().min(1, "Message is required").max(10000, "Message too long"),
    data: zod_1.z.record(zod_1.z.any()).optional(),
    error: errorSchema.optional(),
    service: zod_1.z.string().max(100).optional(),
    environment: zod_1.z.string().max(50).optional(),
    context: zod_1.z.record(zod_1.z.any()).optional(),
    metadata: zod_1.z.any().optional(),
    eventType: exports.eventTypeSchema.optional(),
    userAgent: zod_1.z.string().max(500).optional(),
    url: zod_1.z.string().url().optional().or(zod_1.z.literal("")),
    referrer: zod_1.z.string().url().optional().or(zod_1.z.literal("")),
    responseTime: zod_1.z.number().min(0).optional(),
})
    .strict();
/**
 * Schema for filtering logs via query params
 */
exports.filterLogsSchema = zod_1.z.object({
    projectId: zod_1.z.string().optional(),
    level: exports.logLevelSchema.optional(),
    levels: zod_1.z
        .string()
        .optional()
        .transform((val) => (val ? val.split(",") : undefined))
        .pipe(zod_1.z.array(exports.logLevelSchema).optional()),
    service: zod_1.z.string().optional(),
    services: zod_1.z
        .string()
        .optional()
        .transform((val) => (val ? val.split(",") : undefined)),
    environment: zod_1.z.string().optional(),
    search: zod_1.z.string().optional(),
    startDate: zod_1.z
        .string()
        .optional()
        .transform((val) => (val ? new Date(val) : undefined)),
    endDate: zod_1.z
        .string()
        .optional()
        .transform((val) => (val ? new Date(val) : undefined)),
    eventType: exports.eventTypeSchema.optional(),
    userAgent: zod_1.z.string().optional(),
    url: zod_1.z.string().optional(),
    referrer: zod_1.z.string().optional(),
    errorName: zod_1.z.string().optional(),
    errorMessage: zod_1.z.string().optional(),
    page: zod_1.z
        .string()
        .optional()
        .transform((val) => (val ? Math.max(1, parseInt(val)) : 1)),
    limit: zod_1.z
        .string()
        .optional()
        .transform((val) => {
        if (!val)
            return 10;
        const parsed = parseInt(val);
        return Math.min(100, Math.max(1, parsed)); // Cap at 100
    }),
    sortBy: zod_1.z
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
    sortOrder: zod_1.z.enum(["asc", "desc"]).optional().default("desc"),
});
/**
 * Schema for log ID param
 */
exports.logIdParamSchema = zod_1.z.object({
    logId: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid log ID format"),
});
/**
 * Schema for project ID param
 */
exports.projectIdParamSchema = zod_1.z.object({
    projectId: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid project ID format"),
});
/**
 * Schema for getting distinct values
 */
exports.distinctFieldParamSchema = zod_1.z.object({
    field: zod_1.z.enum(["service", "environment", "level", "eventType", "userAgent"]),
});
/**
 * Schema for delete logs query params
 */
exports.deleteLogsSchema = zod_1.z
    .object({
    projectId: zod_1.z.string().optional(),
    level: exports.logLevelSchema.optional(),
    service: zod_1.z.string().optional(),
    environment: zod_1.z.string().optional(),
    startDate: zod_1.z
        .string()
        .optional()
        .transform((val) => (val ? new Date(val) : undefined)),
    endDate: zod_1.z
        .string()
        .optional()
        .transform((val) => (val ? new Date(val) : undefined)),
    eventType: exports.eventTypeSchema.optional(),
})
    .refine((data) => {
    // At least one filter must be provided to prevent mass deletion
    return (data.level ||
        data.service ||
        data.environment ||
        data.startDate ||
        data.endDate ||
        data.eventType);
}, {
    message: "At least one filter parameter is required for deletion",
});
/**
 * Schema for trends query params
 */
exports.trendsQuerySchema = zod_1.z.object({
    startDate: zod_1.z
        .string()
        .optional()
        .transform((val) => (val ? new Date(val) : undefined)),
    endDate: zod_1.z
        .string()
        .optional()
        .transform((val) => (val ? new Date(val) : undefined)),
    interval: zod_1.z.enum(["hour", "day", "week", "month"]).optional().default("hour"),
});
