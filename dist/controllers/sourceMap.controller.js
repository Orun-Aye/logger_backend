"use strict";
// src/controllers/sourceMap.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourceMapController = void 0;
const sourceMap_service_1 = require("../services/sourceMap.service");
class SourceMapController {
    /**
     * Centralized error handler following existing codebase pattern.
     */
    static handleError(error, res, defaultMessage) {
        console.error(`SourceMapController Error: ${error.message}`, error.stack);
        if (error instanceof sourceMap_service_1.SourceMapValidationError) {
            return res.status(400).json({
                status: "error",
                message: error.message,
                errors: [error.message],
            });
        }
        if (error instanceof sourceMap_service_1.SourceMapNotFoundError) {
            return res.status(404).json({
                status: "error",
                message: error.message,
            });
        }
        if (error instanceof sourceMap_service_1.SourceMapServiceError) {
            return res.status(500).json({
                status: "error",
                message: error.message,
            });
        }
        return res.status(500).json({
            status: "error",
            message: defaultMessage,
        });
    }
    /**
     * Upload a source map.
     * Supports both API key auth (req.projectId from authenticateApiKey) and
     * JWT auth with projectId from route params.
     */
    static async upload(req, res) {
        try {
            // For API-key auth: use req.projectId if available, otherwise use params
            const projectId = req.projectId || req.params.projectId;
            if (!projectId) {
                return res.status(400).json({
                    status: "error",
                    message: "Project ID is required",
                });
            }
            const { release, fileName, originalFileName, sourceMapData, uploadedBy } = req.body;
            if (!release || !fileName || !originalFileName || !sourceMapData) {
                return res.status(400).json({
                    status: "error",
                    message: "release, fileName, originalFileName, and sourceMapData are required",
                });
            }
            const sourceMap = await sourceMap_service_1.SourceMapService.uploadSourceMap(projectId, {
                release,
                fileName,
                originalFileName,
                sourceMapData,
                uploadedBy,
            });
            return res.status(201).json({
                status: "success",
                message: "Source map uploaded successfully",
                data: {
                    _id: sourceMap._id,
                    projectId: sourceMap.projectId,
                    release: sourceMap.release,
                    fileName: sourceMap.fileName,
                    originalFileName: sourceMap.originalFileName,
                    fileSize: sourceMap.fileSize,
                    uploadedBy: sourceMap.uploadedBy,
                    createdAt: sourceMap.createdAt,
                    updatedAt: sourceMap.updatedAt,
                },
            });
        }
        catch (error) {
            return SourceMapController.handleError(error, res, "Failed to upload source map");
        }
    }
    /**
     * List source maps for a project, optionally filtered by release.
     */
    static async list(req, res) {
        try {
            const { projectId } = req.params;
            const release = req.query.release;
            const sourceMaps = await sourceMap_service_1.SourceMapService.listSourceMaps(projectId, release);
            return res.status(200).json({
                status: "success",
                message: "Source maps fetched successfully",
                data: sourceMaps,
            });
        }
        catch (error) {
            return SourceMapController.handleError(error, res, "Failed to list source maps");
        }
    }
    /**
     * Resolve a minified stack trace to original source positions.
     */
    static async resolve(req, res) {
        try {
            const { projectId } = req.params;
            const { release, stackTrace } = req.body;
            if (!release || !stackTrace) {
                return res.status(400).json({
                    status: "error",
                    message: "release and stackTrace are required",
                });
            }
            const resolvedFrames = await sourceMap_service_1.SourceMapService.resolveStackTrace(projectId, release, stackTrace);
            return res.status(200).json({
                status: "success",
                message: "Stack trace resolved successfully",
                data: resolvedFrames,
            });
        }
        catch (error) {
            return SourceMapController.handleError(error, res, "Failed to resolve stack trace");
        }
    }
    /**
     * Delete a source map by ID.
     */
    static async delete(req, res) {
        try {
            const { id } = req.params;
            await sourceMap_service_1.SourceMapService.deleteSourceMap(id);
            return res.status(200).json({
                status: "success",
                message: "Source map deleted successfully",
            });
        }
        catch (error) {
            return SourceMapController.handleError(error, res, "Failed to delete source map");
        }
    }
}
exports.SourceMapController = SourceMapController;
