"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanProjectSchema = exports.acknowledgeAnomalySchema = exports.getAnomaliesQuerySchema = exports.anomalySeveritySchema = exports.anomalyTypeSchema = void 0;
const zod_1 = require("zod");
exports.anomalyTypeSchema = zod_1.z.enum([
    "log_volume_spike",
    "error_rate_increase",
    "response_time_degradation",
    "error_spike",
]);
exports.anomalySeveritySchema = zod_1.z.enum(["critical", "warning", "info"]);
exports.getAnomaliesQuerySchema = zod_1.z.object({
    type: exports.anomalyTypeSchema.optional(),
    severity: exports.anomalySeveritySchema.optional(),
    acknowledged: zod_1.z
        .string()
        .transform((v) => v === "true")
        .optional(),
    resolved: zod_1.z
        .string()
        .transform((v) => v === "true")
        .optional(),
    startDate: zod_1.z.string().datetime().optional(),
    endDate: zod_1.z.string().datetime().optional(),
    limit: zod_1.z
        .string()
        .transform(Number)
        .pipe(zod_1.z.number().int().min(1).max(500))
        .optional(),
    offset: zod_1.z
        .string()
        .transform(Number)
        .pipe(zod_1.z.number().int().min(0))
        .optional(),
});
exports.acknowledgeAnomalySchema = zod_1.z.object({
    anomalyId: zod_1.z.string().min(1),
});
exports.scanProjectSchema = zod_1.z.object({
    projectId: zod_1.z.string().min(1),
});
