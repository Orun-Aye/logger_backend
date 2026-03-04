import { z } from "zod";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const aiProjectIdSchema = z.object({
  projectId: z.string().regex(objectIdRegex, "Invalid project ID"),
});

export const acceptSuggestionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  condition: z.object({
    level: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).optional(),
    keyword: z.string().optional(),
    frequency: z.number().optional(),
    intervalMinutes: z.number().optional(),
    service: z.string().optional(),
    environment: z.string().optional(),
    responseTimeThreshold: z.number().optional(),
    eventType: z.string().optional(),
  }),
  notifyChannels: z.array(z.enum(["email", "slack", "webhook"])).optional().default(["email"]),
});

export type AcceptSuggestionInput = z.infer<typeof acceptSuggestionSchema>;
