"use strict";
// src/validators/savedSearch.validator.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.structuredQuerySchema = exports.exportLogsSchema = exports.batchLogSchema = exports.updateSavedSearchSchema = exports.createSavedSearchSchema = void 0;
const zod_1 = require("zod");
// Time range schema
const timeRangeSchema = zod_1.z.object({
    start: zod_1.z.string().datetime().optional(),
    end: zod_1.z.string().datetime().optional(),
    preset: zod_1.z.enum(["1h", "24h", "7d", "30d", "90d", "custom"]).optional(),
});
// Filters schema
const filtersSchema = zod_1.z.object({
    levels: zod_1.z.array(zod_1.z.enum(["trace", "debug", "info", "warn", "error", "fatal"])).optional(),
    services: zod_1.z.array(zod_1.z.string()).optional(),
    environments: zod_1.z.array(zod_1.z.string()).optional(),
    eventTypes: zod_1.z
        .array(zod_1.z.enum(["error", "performance", "interaction", "network", "console", "pageview", "web-vital", "breadcrumb", "message", "system"]))
        .optional(),
    search: zod_1.z.string().max(500).optional(),
    timeRange: timeRangeSchema.optional(),
    customFilters: zod_1.z.record(zod_1.z.any()).optional(),
});
// Create saved search validator
exports.createSavedSearchSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).trim(),
    description: zod_1.z.string().max(500).trim().optional(),
    filters: filtersSchema,
    isDefault: zod_1.z.boolean().optional().default(false),
    isShared: zod_1.z.boolean().optional().default(false),
    sortBy: zod_1.z.string().max(50).optional().default("timestamp"),
    sortOrder: zod_1.z.enum(["asc", "desc"]).optional().default("desc"),
});
// Update saved search validator
exports.updateSavedSearchSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).trim().optional(),
    description: zod_1.z.string().max(500).trim().optional(),
    filters: filtersSchema.optional(),
    isDefault: zod_1.z.boolean().optional(),
    isShared: zod_1.z.boolean().optional(),
    sortBy: zod_1.z.string().max(50).optional(),
    sortOrder: zod_1.z.enum(["asc", "desc"]).optional(),
});
// Batch log ingestion validator
exports.batchLogSchema = zod_1.z.object({
    logs: zod_1.z
        .array(zod_1.z.object({
        timestamp: zod_1.z.string().datetime().optional(),
        level: zod_1.z.enum(["trace", "debug", "info", "warn", "error", "fatal"]),
        message: zod_1.z.string().min(1).max(5000),
        data: zod_1.z.record(zod_1.z.any()).optional(),
        error: zod_1.z
            .object({
            name: zod_1.z.string().max(200),
            message: zod_1.z.string().max(1000),
            stack: zod_1.z.string().max(10000).optional(),
            url: zod_1.z.string().max(2000).optional(),
            lineNumber: zod_1.z.number().int().optional(),
            columnNumber: zod_1.z.number().int().optional(),
        })
            .optional(),
        service: zod_1.z.string().max(100).optional(),
        environment: zod_1.z.string().max(50).optional(),
        context: zod_1.z.record(zod_1.z.any()).optional(),
        metadata: zod_1.z.any().optional(),
        eventType: zod_1.z
            .enum(["error", "performance", "interaction", "network", "console", "pageview", "web-vital", "breadcrumb", "message", "system"])
            .optional(),
        userAgent: zod_1.z.string().max(500).optional(),
        url: zod_1.z.string().max(2000).optional(),
        referrer: zod_1.z.string().max(2000).optional(),
        correlationId: zod_1.z.string().max(100).optional(),
        sessionId: zod_1.z.string().max(100).optional(),
        traceId: zod_1.z.string().max(100).optional(),
        spanId: zod_1.z.string().max(100).optional(),
        release: zod_1.z.string().max(100).optional(),
    }))
        .min(1)
        .max(100), // Max 100 logs per batch
});
// Export logs validator
exports.exportLogsSchema = zod_1.z.object({
    format: zod_1.z.enum(["csv", "json"]),
    levels: zod_1.z.array(zod_1.z.enum(["trace", "debug", "info", "warn", "error", "fatal"])).optional(),
    services: zod_1.z.array(zod_1.z.string()).optional(),
    environments: zod_1.z.array(zod_1.z.string()).optional(),
    search: zod_1.z.string().max(500).optional(),
    startDate: zod_1.z.string().datetime().optional(),
    endDate: zod_1.z.string().datetime().optional(),
    limit: zod_1.z.number().int().min(1).max(100000).optional().default(10000),
});
// Structured query search validator
exports.structuredQuerySchema = zod_1.z.object({
    query: zod_1.z.string().min(1).max(1000),
    page: zod_1.z.number().int().min(1).optional().default(1),
    limit: zod_1.z.number().int().min(1).max(1000).optional().default(100),
});
