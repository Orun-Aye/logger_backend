"use strict";
// src/validators/webVitals.validator.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.webVitalsByPageSchema = exports.webVitalsHistorySchema = exports.webVitalsQuerySchema = exports.webVitalsProjectIdParamSchema = void 0;
const zod_1 = require("zod");
const objectIdRegex = /^[0-9a-fA-F]{24}$/;
/**
 * Schema for projectId route parameter.
 */
exports.webVitalsProjectIdParamSchema = zod_1.z.object({
    projectId: zod_1.z.string().regex(objectIdRegex, "Invalid project ID format"),
});
/**
 * Valid time range values.
 */
const timeRangeSchema = zod_1.z
    .string()
    .regex(/^\d+[hdwm]$/, "Time range must be in format like 1h, 6h, 24h, 7d, 30d")
    .optional()
    .default("24h");
/**
 * Schema for web vitals query parameters.
 * Supports timeRange filtering and optional page URL filter.
 */
exports.webVitalsQuerySchema = zod_1.z.object({
    timeRange: timeRangeSchema,
    page: zod_1.z.string().optional(), // URL filter (page URL to filter vitals by)
});
/**
 * Schema for web vitals history query parameters.
 * Supports timeRange and interval for time-bucketed aggregation.
 */
exports.webVitalsHistorySchema = zod_1.z.object({
    timeRange: timeRangeSchema,
    interval: zod_1.z.enum(["hour", "day", "week"]).optional().default("hour"),
});
/**
 * Schema for web vitals by page query parameters.
 */
exports.webVitalsByPageSchema = zod_1.z.object({
    timeRange: timeRangeSchema,
});
