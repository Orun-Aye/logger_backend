import { z } from "zod";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const detectRegressionsSchema = z.object({
  currentPeriod: z.string().optional().default("24h"),
  baselinePeriod: z.string().optional().default("7d"),
  threshold: z.coerce.number().min(0).max(100).optional().default(20),
  metrics: z.array(z.enum(["responseTime", "errorRate", "p95", "p99", "logVolume"])).optional(),
});

export const baselineQuerySchema = z.object({
  period: z.string().optional().default("7d"),
});

export const comparePerformanceSchema = z.object({
  currentPeriod: z.string().min(1),
  baselinePeriod: z.string().min(1),
  metrics: z.array(z.string()).optional(),
});

export const regressionProjectIdSchema = z.object({
  projectId: z.string().regex(objectIdRegex, "Invalid project ID"),
});

export type DetectRegressionsInput = z.infer<typeof detectRegressionsSchema>;
export type ComparePerformanceInput = z.infer<typeof comparePerformanceSchema>;
