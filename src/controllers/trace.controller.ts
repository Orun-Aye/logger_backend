// src/controllers/trace.controller.ts

import { Request, Response } from "express";
import {
  TraceService,
  TraceValidationError,
  TraceServiceError,
} from "../services/trace.service";
import {
  traceListQuerySchema,
  traceProjectIdParamSchema,
  traceDetailParamSchema,
} from "../validators/trace.validator";
import { ZodError } from "zod";

/**
 * Response interface for consistent API responses.
 */
interface ApiResponse<T = any> {
  status: "success" | "error";
  message?: string;
  data?: T;
  errors?: any[];
  meta?: any;
}

/**
 * TraceController - Handles HTTP requests for distributed tracing endpoints.
 */
export class TraceController {
  /**
   * Centralized error handler for consistent error responses.
   */
  private static handleError(
    error: Error,
    res: Response,
    defaultMessage: string
  ): Response {
    console.error(`TraceController Error: ${error.message}`, error.stack);

    if (error instanceof ZodError) {
      const formattedErrors = error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
        code: err.code,
      }));
      return res.status(400).json({
        status: "error",
        message: "Validation failed",
        errors: formattedErrors,
      } as ApiResponse);
    }

    if (error instanceof TraceValidationError) {
      return res.status(400).json({
        status: "error",
        message: error.message,
        errors: [error.message],
      } as ApiResponse);
    }

    if (error instanceof TraceServiceError) {
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
   * GET /:projectId/traces
   * Retrieves a paginated list of traces for a project.
   */
  static async getTraces(req: Request, res: Response) {
    try {
      const params = traceProjectIdParamSchema.parse(req.params);
      const query = traceListQuerySchema.parse(req.query);

      const result = await TraceService.getTraces(params.projectId, {
        startDate: query.startDate,
        endDate: query.endDate,
        minDuration: query.minDuration,
        status: query.status,
        service: query.service,
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      });

      return res.status(200).json({
        status: "success",
        data: result,
        meta: {
          projectId: params.projectId,
          page: result.page,
          limit: result.limit,
          total: result.total,
        },
      } as ApiResponse);
    } catch (error) {
      return TraceController.handleError(
        error as Error,
        res,
        "Failed to retrieve traces"
      );
    }
  }

  /**
   * GET /:projectId/traces/:traceId
   * Retrieves all log entries for a specific trace.
   */
  static async getTraceDetail(req: Request, res: Response) {
    try {
      const params = traceDetailParamSchema.parse(req.params);

      const logs = await TraceService.getTraceDetail(
        params.projectId,
        params.traceId
      );

      return res.status(200).json({
        status: "success",
        data: logs,
        meta: {
          projectId: params.projectId,
          traceId: params.traceId,
          logCount: logs.length,
        },
      } as ApiResponse);
    } catch (error) {
      return TraceController.handleError(
        error as Error,
        res,
        "Failed to retrieve trace detail"
      );
    }
  }

  /**
   * GET /:projectId/traces/:traceId/spans
   * Retrieves the span tree for a specific trace.
   */
  static async getTraceSpans(req: Request, res: Response) {
    try {
      const params = traceDetailParamSchema.parse(req.params);

      const spans = await TraceService.getTraceSpans(
        params.projectId,
        params.traceId
      );

      return res.status(200).json({
        status: "success",
        data: spans,
        meta: {
          projectId: params.projectId,
          traceId: params.traceId,
          spanCount: spans.length,
        },
      } as ApiResponse);
    } catch (error) {
      return TraceController.handleError(
        error as Error,
        res,
        "Failed to retrieve trace spans"
      );
    }
  }
}
