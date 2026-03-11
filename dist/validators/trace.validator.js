"use strict";
// src/validators/trace.validator.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.traceDetailParamSchema = exports.traceProjectIdParamSchema = exports.traceListQuerySchema = void 0;
const zod_1 = require("zod");
const objectIdRegex = /^[0-9a-fA-F]{24}$/;
/**
 * Schema for trace list query parameters.
 * Validates projectId from params and optional filters from query string.
 */
exports.traceListQuerySchema = zod_1.z.object({
    startDate: zod_1.z
        .string()
        .optional()
        .transform((val) => (val ? new Date(val) : undefined)),
    endDate: zod_1.z
        .string()
        .optional()
        .transform((val) => (val ? new Date(val) : undefined)),
    minDuration: zod_1.z.coerce.number().min(0).optional(),
    status: zod_1.z.enum(["ok", "error"]).optional(),
    service: zod_1.z.string().optional(),
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
    sortBy: zod_1.z
        .enum(["startTime", "duration", "spanCount"])
        .optional()
        .default("startTime"),
    sortOrder: zod_1.z.enum(["asc", "desc"]).optional().default("desc"),
});
/**
 * Schema for projectId route parameter (used across all trace endpoints).
 */
exports.traceProjectIdParamSchema = zod_1.z.object({
    projectId: zod_1.z.string().regex(objectIdRegex, "Invalid project ID format"),
});
/**
 * Schema for trace detail route parameters (projectId + traceId).
 */
exports.traceDetailParamSchema = zod_1.z.object({
    projectId: zod_1.z.string().regex(objectIdRegex, "Invalid project ID format"),
    traceId: zod_1.z.string().min(1, "Trace ID is required"),
});
