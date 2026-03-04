// src/validators/trace.validator.ts

import { z } from "zod";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

/**
 * Schema for trace list query parameters.
 * Validates projectId from params and optional filters from query string.
 */
export const traceListQuerySchema = z.object({
  startDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  endDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  minDuration: z.coerce.number().min(0).optional(),
  status: z.enum(["ok", "error"]).optional(),
  service: z.string().optional(),
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
  sortBy: z
    .enum(["startTime", "duration", "spanCount"])
    .optional()
    .default("startTime"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

/**
 * Schema for projectId route parameter (used across all trace endpoints).
 */
export const traceProjectIdParamSchema = z.object({
  projectId: z.string().regex(objectIdRegex, "Invalid project ID format"),
});

/**
 * Schema for trace detail route parameters (projectId + traceId).
 */
export const traceDetailParamSchema = z.object({
  projectId: z.string().regex(objectIdRegex, "Invalid project ID format"),
  traceId: z.string().min(1, "Trace ID is required"),
});

// Type exports
export type TraceListQueryInput = z.infer<typeof traceListQuerySchema>;
export type TraceDetailParamInput = z.infer<typeof traceDetailParamSchema>;
