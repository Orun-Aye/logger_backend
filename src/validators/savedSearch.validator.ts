// src/validators/savedSearch.validator.ts

import { z } from "zod";

// Time range schema
const timeRangeSchema = z.object({
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
  preset: z.enum(["1h", "24h", "7d", "30d", "90d", "custom"]).optional(),
});

// Filters schema
const filtersSchema = z.object({
  levels: z.array(z.enum(["trace", "debug", "info", "warn", "error", "fatal"])).optional(),
  services: z.array(z.string()).optional(),
  environments: z.array(z.string()).optional(),
  eventTypes: z
    .array(z.enum(["error", "performance", "interaction", "network", "console", "pageview"]))
    .optional(),
  search: z.string().max(500).optional(),
  timeRange: timeRangeSchema.optional(),
  customFilters: z.record(z.any()).optional(),
});

// Create saved search validator
export const createSavedSearchSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim().optional(),
  filters: filtersSchema,
  isDefault: z.boolean().optional().default(false),
  isShared: z.boolean().optional().default(false),
  sortBy: z.string().max(50).optional().default("timestamp"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

// Update saved search validator
export const updateSavedSearchSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).trim().optional(),
  filters: filtersSchema.optional(),
  isDefault: z.boolean().optional(),
  isShared: z.boolean().optional(),
  sortBy: z.string().max(50).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

// Batch log ingestion validator
export const batchLogSchema = z.object({
  logs: z
    .array(
      z.object({
        timestamp: z.string().datetime().optional(),
        level: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]),
        message: z.string().min(1).max(5000),
        data: z.record(z.any()).optional(),
        error: z
          .object({
            name: z.string().max(200),
            message: z.string().max(1000),
            stack: z.string().max(10000).optional(),
            url: z.string().max(2000).optional(),
            lineNumber: z.number().int().optional(),
            columnNumber: z.number().int().optional(),
          })
          .optional(),
        service: z.string().max(100).optional(),
        environment: z.string().max(50).optional(),
        context: z.record(z.any()).optional(),
        metadata: z.any().optional(),
        eventType: z
          .enum(["error", "performance", "interaction", "network", "console", "pageview"])
          .optional(),
        userAgent: z.string().max(500).optional(),
        url: z.string().max(2000).optional(),
        referrer: z.string().max(2000).optional(),
        correlationId: z.string().max(100).optional(),
        sessionId: z.string().max(100).optional(),
      })
    )
    .min(1)
    .max(100), // Max 100 logs per batch
});

// Export logs validator
export const exportLogsSchema = z.object({
  format: z.enum(["csv", "json"]),
  levels: z.array(z.enum(["trace", "debug", "info", "warn", "error", "fatal"])).optional(),
  services: z.array(z.string()).optional(),
  environments: z.array(z.string()).optional(),
  search: z.string().max(500).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(100000).optional().default(10000),
});

// Structured query search validator
export const structuredQuerySchema = z.object({
  query: z.string().min(1).max(1000),
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(1000).optional().default(100),
});
