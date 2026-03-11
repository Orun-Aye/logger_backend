"use strict";
// src/services/sourceMap.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourceMapService = exports.SourceMapNotFoundError = exports.SourceMapServiceError = exports.SourceMapValidationError = void 0;
const mongoose_1 = require("mongoose");
const sourceMap_model_1 = require("../models/sourceMap.model");
// Custom error classes following existing codebase patterns
class SourceMapValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "SourceMapValidationError";
    }
}
exports.SourceMapValidationError = SourceMapValidationError;
class SourceMapServiceError extends Error {
    context;
    constructor(message, context) {
        super(message);
        this.context = context;
        this.name = "SourceMapServiceError";
    }
}
exports.SourceMapServiceError = SourceMapServiceError;
class SourceMapNotFoundError extends Error {
    constructor(id) {
        super(`Source map with ID ${id} not found`);
        this.name = "SourceMapNotFoundError";
    }
}
exports.SourceMapNotFoundError = SourceMapNotFoundError;
/**
 * Dynamic import of source-map package to avoid hard dependency.
 * Returns null if the package is not installed.
 */
async function getSourceMapConsumer(rawSourceMap) {
    try {
        const { SourceMapConsumer } = await import("source-map");
        return await new SourceMapConsumer(JSON.parse(rawSourceMap));
    }
    catch {
        return null;
    }
}
/**
 * Extracts the filename from a URL or path string.
 * e.g. "https://example.com/static/js/main.abc123.js" -> "main.abc123.js"
 */
function extractFileName(fileOrUrl) {
    try {
        const url = new URL(fileOrUrl);
        const pathParts = url.pathname.split("/");
        return pathParts[pathParts.length - 1] || fileOrUrl;
    }
    catch {
        // Not a valid URL, try splitting by /
        const parts = fileOrUrl.split("/");
        return parts[parts.length - 1] || fileOrUrl;
    }
}
class SourceMapService {
    /**
     * Validates if a given string is a valid MongoDB ObjectId.
     */
    static validateObjectId(id) {
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            throw new SourceMapValidationError(`Invalid ID format: ${id}`);
        }
    }
    /**
     * Uploads (or updates) a source map for a project release.
     * Uses upsert to avoid duplicates based on { projectId, release, originalFileName }.
     */
    static async uploadSourceMap(projectId, data) {
        try {
            this.validateObjectId(projectId);
            // Validate that sourceMapData is valid JSON
            try {
                JSON.parse(data.sourceMapData);
            }
            catch {
                throw new SourceMapValidationError("sourceMapData must be valid JSON");
            }
            const fileSize = Buffer.byteLength(data.sourceMapData, "utf-8");
            const sourceMap = await sourceMap_model_1.SourceMapModel.findOneAndUpdate({
                projectId,
                release: data.release,
                originalFileName: data.originalFileName,
            }, {
                projectId,
                release: data.release,
                fileName: data.fileName,
                originalFileName: data.originalFileName,
                sourceMapData: data.sourceMapData,
                uploadedBy: data.uploadedBy,
                fileSize,
            }, { upsert: true, new: true, runValidators: true });
            return sourceMap;
        }
        catch (error) {
            if (error instanceof SourceMapValidationError ||
                error instanceof SourceMapServiceError) {
                throw error;
            }
            throw new SourceMapServiceError(`Failed to upload source map: ${error.message}`, { projectId, release: data.release, originalError: error });
        }
    }
    /**
     * Lists source maps for a project, optionally filtered by release.
     * Excludes sourceMapData from the result for performance.
     */
    static async listSourceMaps(projectId, release) {
        try {
            this.validateObjectId(projectId);
            const filter = { projectId };
            if (release) {
                filter.release = release;
            }
            const sourceMaps = await sourceMap_model_1.SourceMapModel.find(filter)
                .select("-sourceMapData")
                .sort({ release: -1, fileName: 1 })
                .lean();
            return sourceMaps;
        }
        catch (error) {
            if (error instanceof SourceMapValidationError) {
                throw error;
            }
            throw new SourceMapServiceError(`Failed to list source maps: ${error.message}`, { projectId, release, originalError: error });
        }
    }
    /**
     * Resolves a minified stack trace to original source positions using uploaded source maps.
     *
     * Parses frames from the stack trace, looks up source maps by project/release/filename,
     * and uses the source-map package to map back to original positions.
     */
    static async resolveStackTrace(projectId, release, stackTrace) {
        try {
            this.validateObjectId(projectId);
            // Parse stack trace into frames
            const frameRegex = /at\s+(?:(.+?)\s+\()?(?:(.+?):(\d+):(\d+))\)?/g;
            const frames = [];
            let match;
            while ((match = frameRegex.exec(stackTrace)) !== null) {
                frames.push({
                    functionName: match[1] || undefined,
                    file: match[2],
                    line: parseInt(match[3], 10),
                    column: parseInt(match[4], 10),
                });
            }
            if (frames.length === 0) {
                return [];
            }
            const resolvedFrames = [];
            for (const frame of frames) {
                // Try to find a source map matching this frame's file
                // First try with the full file path/URL, then just the filename
                const fileName = extractFileName(frame.file);
                const sourceMap = await sourceMap_model_1.SourceMapModel.findOne({
                    projectId,
                    release,
                    $or: [
                        { originalFileName: frame.file },
                        { originalFileName: fileName },
                    ],
                });
                if (!sourceMap) {
                    // No source map found for this frame
                    resolvedFrames.push({
                        minified: {
                            file: frame.file,
                            line: frame.line,
                            column: frame.column,
                        },
                        functionName: frame.functionName,
                        resolved: false,
                    });
                    continue;
                }
                // Attempt to resolve using source-map package
                const consumer = await getSourceMapConsumer(sourceMap.sourceMapData);
                if (!consumer) {
                    // source-map package not available
                    resolvedFrames.push({
                        minified: {
                            file: frame.file,
                            line: frame.line,
                            column: frame.column,
                        },
                        functionName: frame.functionName,
                        resolved: false,
                    });
                    continue;
                }
                try {
                    const originalPos = consumer.originalPositionFor({
                        line: frame.line,
                        column: frame.column,
                    });
                    resolvedFrames.push({
                        original: {
                            source: originalPos.source,
                            line: originalPos.line,
                            column: originalPos.column,
                            name: originalPos.name,
                        },
                        minified: {
                            file: frame.file,
                            line: frame.line,
                            column: frame.column,
                        },
                        functionName: frame.functionName,
                        resolved: originalPos.source !== null,
                    });
                }
                finally {
                    if (typeof consumer.destroy === "function") {
                        consumer.destroy();
                    }
                }
            }
            return resolvedFrames;
        }
        catch (error) {
            if (error instanceof SourceMapValidationError ||
                error instanceof SourceMapServiceError) {
                throw error;
            }
            throw new SourceMapServiceError(`Failed to resolve stack trace: ${error.message}`, { projectId, release, originalError: error });
        }
    }
    /**
     * Deletes a source map by its ID.
     */
    static async deleteSourceMap(id) {
        try {
            this.validateObjectId(id);
            const deleted = await sourceMap_model_1.SourceMapModel.findByIdAndDelete(id);
            if (!deleted) {
                throw new SourceMapNotFoundError(id);
            }
        }
        catch (error) {
            if (error instanceof SourceMapValidationError ||
                error instanceof SourceMapNotFoundError ||
                error instanceof SourceMapServiceError) {
                throw error;
            }
            throw new SourceMapServiceError(`Failed to delete source map: ${error.message}`, { id, originalError: error });
        }
    }
}
exports.SourceMapService = SourceMapService;
