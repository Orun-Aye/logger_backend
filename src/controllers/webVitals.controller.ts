// src/controllers/webVitals.controller.ts

import { Request, Response } from "express";
import {
  WebVitalsService,
  WebVitalsValidationError,
  WebVitalsServiceError,
} from "../services/webVitals.service";
import {
  webVitalsProjectIdParamSchema,
  webVitalsQuerySchema,
  webVitalsHistorySchema,
  webVitalsByPageSchema,
} from "../validators/webVitals.validator";
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
 * WebVitalsController - Handles HTTP requests for web vitals aggregation endpoints.
 */
export class WebVitalsController {
  /**
   * Centralized error handler for consistent error responses.
   */
  private static handleError(
    error: Error,
    res: Response,
    defaultMessage: string
  ): Response {
    console.error(`WebVitalsController Error: ${error.message}`, error.stack);

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

    if (error instanceof WebVitalsValidationError) {
      return res.status(400).json({
        status: "error",
        message: error.message,
        errors: [error.message],
      } as ApiResponse);
    }

    if (error instanceof WebVitalsServiceError) {
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
   * GET /:projectId/web-vitals
   * Retrieves aggregated web vitals metrics (p50, p75, p95, rating counts).
   */
  static async getWebVitals(req: Request, res: Response) {
    try {
      const params = webVitalsProjectIdParamSchema.parse(req.params);
      const query = webVitalsQuerySchema.parse(req.query);

      const vitals = await WebVitalsService.getWebVitals(
        params.projectId,
        query.timeRange,
        query.page
      );

      return res.status(200).json({
        status: "success",
        data: vitals,
        meta: {
          projectId: params.projectId,
          timeRange: query.timeRange,
          page: query.page || null,
          vitalCount: vitals.length,
        },
      } as ApiResponse);
    } catch (error) {
      return WebVitalsController.handleError(
        error as Error,
        res,
        "Failed to retrieve web vitals"
      );
    }
  }

  /**
   * GET /:projectId/web-vitals/history
   * Retrieves time-bucketed web vitals history for charting.
   */
  static async getWebVitalsHistory(req: Request, res: Response) {
    try {
      const params = webVitalsProjectIdParamSchema.parse(req.params);
      const query = webVitalsHistorySchema.parse(req.query);

      const history = await WebVitalsService.getWebVitalsHistory(
        params.projectId,
        query.timeRange,
        query.interval
      );

      return res.status(200).json({
        status: "success",
        data: history,
        meta: {
          projectId: params.projectId,
          timeRange: query.timeRange,
          interval: query.interval,
          dataPoints: history.length,
        },
      } as ApiResponse);
    } catch (error) {
      return WebVitalsController.handleError(
        error as Error,
        res,
        "Failed to retrieve web vitals history"
      );
    }
  }

  /**
   * GET /:projectId/web-vitals/pages
   * Retrieves web vitals aggregated per page URL.
   */
  static async getWebVitalsByPage(req: Request, res: Response) {
    try {
      const params = webVitalsProjectIdParamSchema.parse(req.params);
      const query = webVitalsByPageSchema.parse(req.query);

      const pages = await WebVitalsService.getWebVitalsByPage(
        params.projectId,
        query.timeRange
      );

      return res.status(200).json({
        status: "success",
        data: pages,
        meta: {
          projectId: params.projectId,
          timeRange: query.timeRange,
          pageCount: pages.length,
        },
      } as ApiResponse);
    } catch (error) {
      return WebVitalsController.handleError(
        error as Error,
        res,
        "Failed to retrieve web vitals by page"
      );
    }
  }
}
