import { z } from "zod";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const funnelStepSchema = z.object({
  name: z.string().min(1).max(100),
  eventType: z.enum(["error", "performance", "interaction", "network", "console", "pageview"]).optional(),
  url: z.string().optional(),
  message: z.string().optional(),
  level: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).optional(),
});

export const analyzeFunnelSchema = z.object({
  steps: z.array(funnelStepSchema).min(2).max(10),
  timeRange: z.string().optional().default("7d"),
  environment: z.string().optional(),
});

export const popularPathsQuerySchema = z.object({
  timeRange: z.string().optional().default("7d"),
  limit: z.coerce.number().min(1).max(50).optional().default(10),
});

export const projectIdParamSchema = z.object({
  projectId: z.string().regex(objectIdRegex, "Invalid project ID"),
});

export type AnalyzeFunnelInput = z.infer<typeof analyzeFunnelSchema>;
