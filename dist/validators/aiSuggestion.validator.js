"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.acceptSuggestionSchema = exports.aiProjectIdSchema = void 0;
const zod_1 = require("zod");
const objectIdRegex = /^[0-9a-fA-F]{24}$/;
exports.aiProjectIdSchema = zod_1.z.object({
    projectId: zod_1.z.string().regex(objectIdRegex, "Invalid project ID"),
});
exports.acceptSuggestionSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    description: zod_1.z.string().max(500).optional(),
    condition: zod_1.z.object({
        level: zod_1.z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).optional(),
        keyword: zod_1.z.string().optional(),
        frequency: zod_1.z.number().optional(),
        intervalMinutes: zod_1.z.number().optional(),
        service: zod_1.z.string().optional(),
        environment: zod_1.z.string().optional(),
        responseTimeThreshold: zod_1.z.number().optional(),
        eventType: zod_1.z.string().optional(),
    }),
    notifyChannels: zod_1.z.array(zod_1.z.enum(["email", "slack", "webhook"])).optional().default(["email"]),
});
