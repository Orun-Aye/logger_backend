"use strict";
// src/validators/project.validator.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.samplingConfigSchema = exports.integrationSettingsSchema = exports.listProjectsQuerySchema = exports.bulkUpdateProjectsSchema = exports.bulkDeleteProjectsSchema = exports.duplicateProjectBodySchema = exports.duplicateProjectParamSchema = exports.transferOwnershipSchema = exports.rateLimitConfigSchema = exports.tagsSchema = exports.updateTeamMemberRoleSchema = exports.removeTeamMemberSchema = exports.addTeamMemberSchema = exports.projectIdParamSchema = exports.updateProjectSchema = exports.createProjectSchema = void 0;
const zod_1 = require("zod");
/**
 * MongoDB ObjectId regex pattern
 */
const objectIdRegex = /^[0-9a-fA-F]{24}$/;
/**
 * Schema for creating a new project
 */
exports.createProjectSchema = zod_1.z.object({
    name: zod_1.z
        .string()
        .min(1, "Project name is required")
        .max(100, "Project name is too long")
        .trim(),
    description: zod_1.z.string().max(500, "Description is too long").optional(),
    ownerId: zod_1.z.string().regex(objectIdRegex, "Invalid owner ID format"),
});
/**
 * Schema for updating a project
 */
exports.updateProjectSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).trim().optional(),
    description: zod_1.z.string().max(500).optional(),
    isActive: zod_1.z.boolean().optional(),
    tags: zod_1.z.array(zod_1.z.string().max(50)).max(20, "Too many tags").optional(),
});
/**
 * Schema for project ID param
 */
exports.projectIdParamSchema = zod_1.z.object({
    id: zod_1.z.string().regex(objectIdRegex, "Invalid project ID format"),
});
/**
 * Schema for adding a team member
 */
exports.addTeamMemberSchema = zod_1.z.object({
    userId: zod_1.z.string().regex(objectIdRegex, "Invalid user ID format"),
    role: zod_1.z.enum(["admin", "viewer"]),
});
/**
 * Schema for removing a team member
 */
exports.removeTeamMemberSchema = zod_1.z.object({
    userId: zod_1.z.string().regex(objectIdRegex, "Invalid user ID format"),
});
/**
 * Schema for updating team member role
 */
exports.updateTeamMemberRoleSchema = zod_1.z.object({
    userId: zod_1.z.string().regex(objectIdRegex, "Invalid user ID format"),
    role: zod_1.z.enum(["admin", "viewer"]),
});
/**
 * Schema for adding/removing tags
 */
exports.tagsSchema = zod_1.z.object({
    tags: zod_1.z.array(zod_1.z.string().max(50)).min(1, "At least one tag is required"),
});
/**
 * Schema for updating rate limit config
 */
exports.rateLimitConfigSchema = zod_1.z.object({
    requestsPerMinute: zod_1.z
        .number()
        .int()
        .min(10, "Minimum 10 requests per minute")
        .max(10000, "Maximum 10000 requests per minute"),
});
/**
 * Schema for transferring ownership
 */
exports.transferOwnershipSchema = zod_1.z.object({
    newOwnerId: zod_1.z.string().regex(objectIdRegex, "Invalid user ID format"),
});
/**
 * Schema for duplicate project params
 */
exports.duplicateProjectParamSchema = zod_1.z.object({
    sourceProjectId: zod_1.z.string().regex(objectIdRegex, "Invalid project ID format"),
});
/**
 * Schema for duplicate project body
 */
exports.duplicateProjectBodySchema = zod_1.z.object({
    newName: zod_1.z
        .string()
        .min(1, "Project name is required")
        .max(100, "Project name is too long")
        .trim(),
    includeTeamMembers: zod_1.z.boolean().optional().default(false),
    includeAlertRules: zod_1.z.boolean().optional().default(false),
});
/**
 * Schema for bulk delete projects
 */
exports.bulkDeleteProjectsSchema = zod_1.z.object({
    projectIds: zod_1.z
        .array(zod_1.z.string().regex(objectIdRegex, "Invalid project ID format"))
        .min(1, "At least one project ID is required")
        .max(50, "Too many projects selected"),
});
/**
 * Schema for bulk update projects
 */
exports.bulkUpdateProjectsSchema = zod_1.z.object({
    projectIds: zod_1.z
        .array(zod_1.z.string().regex(objectIdRegex, "Invalid project ID format"))
        .min(1, "At least one project ID is required")
        .max(50, "Too many projects selected"),
    updates: zod_1.z.object({
        isActive: zod_1.z.boolean().optional(),
        tags: zod_1.z.array(zod_1.z.string().max(50)).max(20).optional(),
    }),
});
/**
 * Schema for query parameters when listing projects
 */
exports.listProjectsQuerySchema = zod_1.z.object({
    searchBy: zod_1.z.enum(["owner", "team", "both"]).optional().default("both"),
    isActive: zod_1.z
        .string()
        .optional()
        .transform((val) => {
        if (val === "true")
            return true;
        if (val === "false")
            return false;
        return undefined;
    }),
    tags: zod_1.z
        .string()
        .optional()
        .transform((val) => (val ? val.split(",") : undefined)),
    page: zod_1.z
        .string()
        .optional()
        .transform((val) => (val ? Math.max(1, parseInt(val)) : 1)),
    limit: zod_1.z
        .string()
        .optional()
        .transform((val) => {
        if (!val)
            return 20;
        const parsed = parseInt(val);
        return Math.min(100, Math.max(1, parsed));
    }),
});
/**
 * Schema for integration settings update
 */
exports.integrationSettingsSchema = zod_1.z.object({
    slack: zod_1.z
        .object({
        enabled: zod_1.z.boolean(),
        webhookUrl: zod_1.z.string().url().optional(),
    })
        .optional(),
    email: zod_1.z
        .object({
        enabled: zod_1.z.boolean(),
        recipients: zod_1.z.array(zod_1.z.string().email()).optional(),
    })
        .optional(),
    webhook: zod_1.z
        .object({
        enabled: zod_1.z.boolean(),
        url: zod_1.z.string().url().optional(),
        headers: zod_1.z.record(zod_1.z.string()).optional(),
    })
        .optional(),
});
/**
 * Schema for sampling configuration
 */
exports.samplingConfigSchema = zod_1.z.object({
    enabled: zod_1.z.boolean(),
    mode: zod_1.z.enum(["rate", "percentage"]),
    value: zod_1.z.number().min(1).max(1000),
    alwaysKeepLevels: zod_1.z
        .array(zod_1.z.enum(["trace", "debug", "info", "warn", "error", "fatal"]))
        .optional()
        .default(["error", "fatal"]),
});
