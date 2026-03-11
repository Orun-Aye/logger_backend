"use strict";
// src/validators/sourceMap.validator.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.sourceMapProjectIdParamSchema = exports.sourceMapIdParamSchema = exports.resolveStackTraceSchema = exports.listSourceMapsSchema = exports.uploadSourceMapSchema = void 0;
const zod_1 = require("zod");
/**
 * MongoDB ObjectId regex pattern
 */
const objectIdRegex = /^[0-9a-fA-F]{24}$/;
/**
 * Schema for uploading a source map
 */
exports.uploadSourceMapSchema = zod_1.z.object({
    release: zod_1.z
        .string()
        .min(1, "Release version is required")
        .max(100, "Release version must be 100 characters or less"),
    fileName: zod_1.z.string().min(1, "File name is required"),
    originalFileName: zod_1.z.string().min(1, "Original file name is required"),
    sourceMapData: zod_1.z.string().min(1, "Source map data is required"),
    uploadedBy: zod_1.z.string().optional(),
});
/**
 * Schema for listing source maps (query params)
 */
exports.listSourceMapsSchema = zod_1.z.object({
    release: zod_1.z.string().optional(),
});
/**
 * Schema for resolving a stack trace
 */
exports.resolveStackTraceSchema = zod_1.z.object({
    release: zod_1.z.string().min(1, "Release version is required"),
    stackTrace: zod_1.z.string().min(1, "Stack trace text is required"),
});
/**
 * Schema for source map ID parameter
 */
exports.sourceMapIdParamSchema = zod_1.z.object({
    id: zod_1.z
        .string()
        .regex(objectIdRegex, "Invalid source map ID format"),
});
/**
 * Schema for project ID parameter (source map routes)
 */
exports.sourceMapProjectIdParamSchema = zod_1.z.object({
    projectId: zod_1.z
        .string()
        .regex(objectIdRegex, "Invalid project ID format"),
});
