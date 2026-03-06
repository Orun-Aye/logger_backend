import { z } from "zod";

export const anomalyTypeSchema = z.enum([
  "log_volume_spike",
  "error_rate_increase",
  "response_time_degradation",
  "error_spike",
]);

export const anomalySeveritySchema = z.enum(["critical", "warning", "info"]);

export const getAnomaliesQuerySchema = z.object({
  type: anomalyTypeSchema.optional(),
  severity: anomalySeveritySchema.optional(),
  acknowledged: z
    .string()
    .transform((v) => v === "true")
    .optional(),
  resolved: z
    .string()
    .transform((v) => v === "true")
    .optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(500))
    .optional(),
  offset: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(0))
    .optional(),
});

export const acknowledgeAnomalySchema = z.object({
  anomalyId: z.string().min(1),
});

export const scanProjectSchema = z.object({
  projectId: z.string().min(1),
});
