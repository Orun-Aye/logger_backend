"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectIdParamSchema = exports.popularPathsQuerySchema = exports.analyzeFunnelSchema = void 0;
const zod_1 = require("zod");
const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const funnelStepSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    eventType: zod_1.z.enum(["error", "performance", "interaction", "network", "console", "pageview"]).optional(),
    url: zod_1.z.string().optional(),
    message: zod_1.z.string().optional(),
    level: zod_1.z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).optional(),
});
exports.analyzeFunnelSchema = zod_1.z.object({
    steps: zod_1.z.array(funnelStepSchema).min(2).max(10),
    timeRange: zod_1.z.string().optional().default("7d"),
    environment: zod_1.z.string().optional(),
});
exports.popularPathsQuerySchema = zod_1.z.object({
    timeRange: zod_1.z.string().optional().default("7d"),
    limit: zod_1.z.coerce.number().min(1).max(50).optional().default(10),
});
exports.projectIdParamSchema = zod_1.z.object({
    projectId: zod_1.z.string().regex(objectIdRegex, "Invalid project ID"),
});
