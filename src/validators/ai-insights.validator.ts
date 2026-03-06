import { z } from "zod";

export const askQuestionSchema = z.object({
  question: z.string().min(1).max(500),
});

export const rootCauseParamsSchema = z.object({
  projectId: z.string().min(1),
  errorId: z.string().min(1),
});

export const enrichedInsightsQuerySchema = z.object({
  timeRange: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(720))
    .optional(),
});
