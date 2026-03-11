"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.regressionProjectIdSchema = exports.comparePerformanceSchema = exports.baselineQuerySchema = exports.detectRegressionsSchema = void 0;
const zod_1 = require("zod");
const objectIdRegex = /^[0-9a-fA-F]{24}$/;
exports.detectRegressionsSchema = zod_1.z.object({
    currentPeriod: zod_1.z.string().optional().default("24h"),
    baselinePeriod: zod_1.z.string().optional().default("7d"),
    threshold: zod_1.z.coerce.number().min(0).max(100).optional().default(20),
    metrics: zod_1.z.array(zod_1.z.enum(["responseTime", "errorRate", "p95", "p99", "logVolume"])).optional(),
});
exports.baselineQuerySchema = zod_1.z.object({
    period: zod_1.z.string().optional().default("7d"),
});
exports.comparePerformanceSchema = zod_1.z.object({
    currentPeriod: zod_1.z.string().min(1),
    baselinePeriod: zod_1.z.string().min(1),
    metrics: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.regressionProjectIdSchema = zod_1.z.object({
    projectId: zod_1.z.string().regex(objectIdRegex, "Invalid project ID"),
});
