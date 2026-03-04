// src/validators/sourceMap.validator.ts

import { z } from "zod";

/**
 * MongoDB ObjectId regex pattern
 */
const objectIdRegex = /^[0-9a-fA-F]{24}$/;

/**
 * Schema for uploading a source map
 */
export const uploadSourceMapSchema = z.object({
  release: z
    .string()
    .min(1, "Release version is required")
    .max(100, "Release version must be 100 characters or less"),
  fileName: z.string().min(1, "File name is required"),
  originalFileName: z.string().min(1, "Original file name is required"),
  sourceMapData: z.string().min(1, "Source map data is required"),
  uploadedBy: z.string().optional(),
});

/**
 * Schema for listing source maps (query params)
 */
export const listSourceMapsSchema = z.object({
  release: z.string().optional(),
});

/**
 * Schema for resolving a stack trace
 */
export const resolveStackTraceSchema = z.object({
  release: z.string().min(1, "Release version is required"),
  stackTrace: z.string().min(1, "Stack trace text is required"),
});

/**
 * Schema for source map ID parameter
 */
export const sourceMapIdParamSchema = z.object({
  id: z
    .string()
    .regex(objectIdRegex, "Invalid source map ID format"),
});

/**
 * Schema for project ID parameter (source map routes)
 */
export const sourceMapProjectIdParamSchema = z.object({
  projectId: z
    .string()
    .regex(objectIdRegex, "Invalid project ID format"),
});

// Type exports
export type UploadSourceMapInput = z.infer<typeof uploadSourceMapSchema>;
export type ListSourceMapsInput = z.infer<typeof listSourceMapsSchema>;
export type ResolveStackTraceInput = z.infer<typeof resolveStackTraceSchema>;
