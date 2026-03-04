// src/validators/project.validator.ts

import { z } from "zod";

/**
 * MongoDB ObjectId regex pattern
 */
const objectIdRegex = /^[0-9a-fA-F]{24}$/;

/**
 * Schema for creating a new project
 */
export const createProjectSchema = z.object({
  name: z
    .string()
    .min(1, "Project name is required")
    .max(100, "Project name is too long")
    .trim(),
  description: z.string().max(500, "Description is too long").optional(),
  ownerId: z.string().regex(objectIdRegex, "Invalid owner ID format"),
});

/**
 * Schema for updating a project
 */
export const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
  tags: z.array(z.string().max(50)).max(20, "Too many tags").optional(),
});

/**
 * Schema for project ID param
 */
export const projectIdParamSchema = z.object({
  id: z.string().regex(objectIdRegex, "Invalid project ID format"),
});

/**
 * Schema for adding a team member
 */
export const addTeamMemberSchema = z.object({
  userId: z.string().regex(objectIdRegex, "Invalid user ID format"),
  role: z.enum(["admin", "viewer"]),
});

/**
 * Schema for removing a team member
 */
export const removeTeamMemberSchema = z.object({
  userId: z.string().regex(objectIdRegex, "Invalid user ID format"),
});

/**
 * Schema for updating team member role
 */
export const updateTeamMemberRoleSchema = z.object({
  userId: z.string().regex(objectIdRegex, "Invalid user ID format"),
  role: z.enum(["admin", "viewer"]),
});

/**
 * Schema for adding/removing tags
 */
export const tagsSchema = z.object({
  tags: z.array(z.string().max(50)).min(1, "At least one tag is required"),
});

/**
 * Schema for updating rate limit config
 */
export const rateLimitConfigSchema = z.object({
  requestsPerMinute: z
    .number()
    .int()
    .min(10, "Minimum 10 requests per minute")
    .max(10000, "Maximum 10000 requests per minute"),
});

/**
 * Schema for transferring ownership
 */
export const transferOwnershipSchema = z.object({
  newOwnerId: z.string().regex(objectIdRegex, "Invalid user ID format"),
});

/**
 * Schema for duplicate project params
 */
export const duplicateProjectParamSchema = z.object({
  sourceProjectId: z.string().regex(objectIdRegex, "Invalid project ID format"),
});

/**
 * Schema for duplicate project body
 */
export const duplicateProjectBodySchema = z.object({
  newName: z
    .string()
    .min(1, "Project name is required")
    .max(100, "Project name is too long")
    .trim(),
  includeTeamMembers: z.boolean().optional().default(false),
  includeAlertRules: z.boolean().optional().default(false),
});

/**
 * Schema for bulk delete projects
 */
export const bulkDeleteProjectsSchema = z.object({
  projectIds: z
    .array(z.string().regex(objectIdRegex, "Invalid project ID format"))
    .min(1, "At least one project ID is required")
    .max(50, "Too many projects selected"),
});

/**
 * Schema for bulk update projects
 */
export const bulkUpdateProjectsSchema = z.object({
  projectIds: z
    .array(z.string().regex(objectIdRegex, "Invalid project ID format"))
    .min(1, "At least one project ID is required")
    .max(50, "Too many projects selected"),
  updates: z.object({
    isActive: z.boolean().optional(),
    tags: z.array(z.string().max(50)).max(20).optional(),
  }),
});

/**
 * Schema for query parameters when listing projects
 */
export const listProjectsQuerySchema = z.object({
  searchBy: z.enum(["owner", "team", "both"]).optional().default("both"),
  isActive: z
    .string()
    .optional()
    .transform((val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      return undefined;
    }),
  tags: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",") : undefined)),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Math.max(1, parseInt(val)) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return 20;
      const parsed = parseInt(val);
      return Math.min(100, Math.max(1, parsed));
    }),
});

/**
 * Schema for integration settings update
 */
export const integrationSettingsSchema = z.object({
  slack: z
    .object({
      enabled: z.boolean(),
      webhookUrl: z.string().url().optional(),
    })
    .optional(),
  email: z
    .object({
      enabled: z.boolean(),
      recipients: z.array(z.string().email()).optional(),
    })
    .optional(),
  webhook: z
    .object({
      enabled: z.boolean(),
      url: z.string().url().optional(),
      headers: z.record(z.string()).optional(),
    })
    .optional(),
});

/**
 * Schema for sampling configuration
 */
export const samplingConfigSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(["rate", "percentage"]),
  value: z.number().min(1).max(1000),
  alwaysKeepLevels: z
    .array(z.enum(["trace", "debug", "info", "warn", "error", "fatal"]))
    .optional()
    .default(["error", "fatal"]),
});

export type SamplingConfigInput = z.infer<typeof samplingConfigSchema>;

// Type exports
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type AddTeamMemberInput = z.infer<typeof addTeamMemberSchema>;
export type UpdateTeamMemberRoleInput = z.infer<typeof updateTeamMemberRoleSchema>;
export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;
export type DuplicateProjectInput = z.infer<typeof duplicateProjectBodySchema>;
export type BulkDeleteProjectsInput = z.infer<typeof bulkDeleteProjectsSchema>;
export type BulkUpdateProjectsInput = z.infer<typeof bulkUpdateProjectsSchema>;
