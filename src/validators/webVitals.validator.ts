// src/validators/webVitals.validator.ts

import { z } from "zod";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

/**
 * Schema for projectId route parameter.
 */
export const webVitalsProjectIdParamSchema = z.object({
  projectId: z.string().regex(objectIdRegex, "Invalid project ID format"),
});

/**
 * Valid time range values.
 */
const timeRangeSchema = z
  .string()
  .regex(/^\d+[hdwm]$/, "Time range must be in format like 1h, 6h, 24h, 7d, 30d")
  .optional()
  .default("24h");

/**
 * Schema for web vitals query parameters.
 * Supports timeRange filtering and optional page URL filter.
 */
export const webVitalsQuerySchema = z.object({
  timeRange: timeRangeSchema,
  page: z.string().optional(), // URL filter (page URL to filter vitals by)
});

/**
 * Schema for web vitals history query parameters.
 * Supports timeRange and interval for time-bucketed aggregation.
 */
export const webVitalsHistorySchema = z.object({
  timeRange: timeRangeSchema,
  interval: z.enum(["hour", "day", "week"]).optional().default("hour"),
});

/**
 * Schema for web vitals by page query parameters.
 */
export const webVitalsByPageSchema = z.object({
  timeRange: timeRangeSchema,
});

// Type exports
export type WebVitalsQueryInput = z.infer<typeof webVitalsQuerySchema>;
export type WebVitalsHistoryInput = z.infer<typeof webVitalsHistorySchema>;
export type WebVitalsByPageInput = z.infer<typeof webVitalsByPageSchema>;
