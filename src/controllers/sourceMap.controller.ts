// src/controllers/sourceMap.controller.ts

import { Request, Response } from "express";
import {
  SourceMapService,
  SourceMapValidationError,
  SourceMapNotFoundError,
  SourceMapServiceError,
} from "../services/sourceMap.service";

interface ApiResponse<T = any> {
  status: "success" | "error";
  message?: string;
  data?: T;
  errors?: string[];
}

export class SourceMapController {
  /**
   * Centralized error handler following existing codebase pattern.
   */
  private static handleError(
    error: Error,
    res: Response,
    defaultMessage: string
  ): Response {
    console.error(`SourceMapController Error: ${error.message}`, error.stack);

    if (error instanceof SourceMapValidationError) {
      return res.status(400).json({
        status: "error",
        message: error.message,
        errors: [error.message],
      } as ApiResponse);
    }

    if (error instanceof SourceMapNotFoundError) {
      return res.status(404).json({
        status: "error",
        message: error.message,
      } as ApiResponse);
    }

    if (error instanceof SourceMapServiceError) {
      return res.status(500).json({
        status: "error",
        message: error.message,
      } as ApiResponse);
    }

    return res.status(500).json({
      status: "error",
      message: defaultMessage,
    } as ApiResponse);
  }

  /**
   * Upload a source map.
   * Supports both API key auth (req.projectId from authenticateApiKey) and
   * JWT auth with projectId from route params.
   */
  static async upload(req: Request, res: Response): Promise<Response> {
    try {
      // For API-key auth: use req.projectId if available, otherwise use params
      const projectId = req.projectId || req.params.projectId;

      if (!projectId) {
        return res.status(400).json({
          status: "error",
          message: "Project ID is required",
        } as ApiResponse);
      }

      const { release, fileName, originalFileName, sourceMapData, uploadedBy } =
        req.body;

      if (!release || !fileName || !originalFileName || !sourceMapData) {
        return res.status(400).json({
          status: "error",
          message:
            "release, fileName, originalFileName, and sourceMapData are required",
        } as ApiResponse);
      }

      const sourceMap = await SourceMapService.uploadSourceMap(projectId, {
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
      } as ApiResponse);
    } catch (error) {
      return SourceMapController.handleError(
        error as Error,
        res,
        "Failed to upload source map"
      );
    }
  }

  /**
   * List source maps for a project, optionally filtered by release.
   */
  static async list(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const release = req.query.release as string | undefined;

      const sourceMaps = await SourceMapService.listSourceMaps(
        projectId,
        release
      );

      return res.status(200).json({
        status: "success",
        message: "Source maps fetched successfully",
        data: sourceMaps,
      } as ApiResponse);
    } catch (error) {
      return SourceMapController.handleError(
        error as Error,
        res,
        "Failed to list source maps"
      );
    }
  }

  /**
   * Resolve a minified stack trace to original source positions.
   */
  static async resolve(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { release, stackTrace } = req.body;

      if (!release || !stackTrace) {
        return res.status(400).json({
          status: "error",
          message: "release and stackTrace are required",
        } as ApiResponse);
      }

      const resolvedFrames = await SourceMapService.resolveStackTrace(
        projectId,
        release,
        stackTrace
      );

      return res.status(200).json({
        status: "success",
        message: "Stack trace resolved successfully",
        data: resolvedFrames,
      } as ApiResponse);
    } catch (error) {
      return SourceMapController.handleError(
        error as Error,
        res,
        "Failed to resolve stack trace"
      );
    }
  }

  /**
   * Delete a source map by ID.
   */
  static async delete(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      await SourceMapService.deleteSourceMap(id);

      return res.status(200).json({
        status: "success",
        message: "Source map deleted successfully",
      } as ApiResponse);
    } catch (error) {
      return SourceMapController.handleError(
        error as Error,
        res,
        "Failed to delete source map"
      );
    }
  }
}
