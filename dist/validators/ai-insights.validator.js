"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrichedInsightsQuerySchema = exports.rootCauseParamsSchema = exports.askQuestionSchema = void 0;
const zod_1 = require("zod");
exports.askQuestionSchema = zod_1.z.object({
    question: zod_1.z.string().min(1).max(500),
});
exports.rootCauseParamsSchema = zod_1.z.object({
    projectId: zod_1.z.string().min(1),
    errorId: zod_1.z.string().min(1),
});
exports.enrichedInsightsQuerySchema = zod_1.z.object({
    timeRange: zod_1.z
        .string()
        .transform(Number)
        .pipe(zod_1.z.number().int().min(1).max(720))
        .optional(),
});
