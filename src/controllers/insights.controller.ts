import { Request, Response } from "express";
import {
  DashboardInsightsService,
  DashboardInsightsServiceError,
  ProjectNotFoundError,
} from "../services/insights.service";
import { DashboardInsights } from "../types/app";
import { GetInsightsDTO } from "../dtos/dashboard.dto";
import { LogLevel } from "../dtos/log.dto";

/**
 * Standard API response interface for consistent JSON responses.
 */
interface ApiResponse<T = any> {
  status: "success" | "error";
  message?: string;
  data?: T;
  errors?: string[];
  meta?: any;
}

/**
 * Controller class for handling dashboard insights API endpoints.
 * All methods are static to be used directly as Express route handlers.
 */
export class DashboardInsightsController {
  /**
   * Centralized error handling for controller methods.
   * Maps service errors or generic errors to appropriate HTTP responses.
   * @param error The error object.
   * @param res The Express response object.
   * @param defaultMessage A default message for generic errors.
   * @returns The Express response with an error status and message.
   */
  private static handleError(
    error: Error,
    res: Response,
    defaultMessage: string
  ): Response {
    console.error(
      `DashboardInsightsController Error: ${error.message}`,
      error.stack
    );

    if (error instanceof ProjectNotFoundError) {
      return res.status(404).json({
        status: "error",
        message: error.message,
      } as ApiResponse);
    }

    if (error instanceof DashboardInsightsServiceError) {
      return res.status(400).json({
        // Use 400 for service-level validation/business logic errors
        status: "error",
        message: error.message,
        errors: [error.message],
      } as ApiResponse);
    }

    // Handle Mongoose specific errors (e.g., CastError for invalid ObjectId)
    if (error.name === "CastError") {
      return res.status(400).json({
        status: "error",
        message: "Invalid ID format.",
      } as ApiResponse);
    }

    // Generic server error
    return res.status(500).json({
      status: "error",
      message: defaultMessage,
      errors: [error.message || "An unexpected error occurred."],
    } as ApiResponse);
  }

  /**
   * Validates and parses query parameters for fetching insights.
   * @param req The Express request object.
   * @returns A GetInsightsDTO object with validated parameters.
   */
  private static validateInsightsQueryParams(req: Request): GetInsightsDTO {
    const { range, from, to, severity, timezone } = req.query;

    const validRanges = [
      "1d",
      "7d",
      "30d",
      "custom",
      "24h",
      "1h",
      "1w",
      "4w",
      "1m",
      "3m",
      "6m",
      "1y",
    ];
    const validSeverities = Object.values(LogLevel);

    // Validate range
    let validatedRange: GetInsightsDTO["range"] = "7d"; // Default
    if (typeof range === "string" && validRanges.includes(range)) {
      validatedRange = range as GetInsightsDTO["range"];
    }

    // Validate from/to for custom range
    let validatedFrom: string | undefined;
    let validatedTo: string | undefined;
    if (validatedRange === "custom") {
      if (typeof from === "string" && from) validatedFrom = from;
      if (typeof to === "string" && to) validatedTo = to;
    }

    // Validate severity
    let validatedSeverity: GetInsightsDTO["severity"] = undefined;
    if (
      typeof severity === "string" &&
      validSeverities.includes(severity as LogLevel)
    ) {
      validatedSeverity = severity as LogLevel;
    }

    // Validate timezone
    let validatedTimezone: string | undefined;
    if (typeof timezone === "string" && timezone) {
      // Basic check for valid timezone format (e.g., 'UTC', 'America/New_York')
      // A more robust validation might involve a library like 'luxon' or 'moment-timezone'
      validatedTimezone = timezone;
    }

    return {
      range: validatedRange,
      from: validatedFrom,
      to: validatedTo,
      severity: validatedSeverity,
      timezone: validatedTimezone,
    };
  }

  /**
   * Handles fetching dashboard insights for a specific project.
   * GET /api/insights/:projectId
   */
  static async getProjectInsights(
    req: Request,
    res: Response
  ): Promise<Response> {
    const startTime = process.hrtime.bigint(); // Start timing controller execution

    try {
      const { projectId } = req.params;
      if (!projectId) {
        return res.status(400).json({
          status: "error",
          message: "Project ID is required in the URL",
        } as ApiResponse);
      }

      // Validate and parse insights query paramters
      const insightsOptions: GetInsightsDTO =
        DashboardInsightsController.validateInsightsQueryParams(req);

      // Call the service method
      const insights: DashboardInsights =
        await DashboardInsightsService.getProjectInsights(
          projectId,
          insightsOptions
        );

      const endTime = process.hrtime.bigint();
      const queryExecutionTime = Number(endTime - startTime) / 1_000_000; // Convert to ms

      // Add controller-level metadata
      const responseMeta = {
        ...insights.meta, // Include meta from service (cached status, service query time),
        controllerExecutionTime: queryExecutionTime,
      };

      // Ensure timeRange.from/to are ISO strings in meta for consistent API response
      if (insights.timeRange) {
        responseMeta.timeRange = {
          from: insights.timeRange.from.toISOString(),
          to: insights.timeRange.from.toISOString(),
          range: insights.timeRange.range,
        };
      }

      return res.status(200).json({
        status: "success",
        message: "Dashboard insights fetched successfully.",
        data: insights,
        meta: responseMeta,
      } as ApiResponse);
    } catch (error) {
      return DashboardInsightsController.handleError(
        error as Error,
        res,
        "Failed to fetch dashboard insights"
      );
    }
  }

  /**
   * Handles invalidating the cache for a specific project.
   * POST /api/insights/:projectId/invalidate-cache
   */
  static async invalidateProjectCache(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const { projectId } = req.params;
      if (!projectId) {
        return res.status(400).json({
          status: "error",
          message: "Project ID is required",
        } as ApiResponse);
      }

      await DashboardInsightsService.invalidateProjectCache(projectId);

      return res.status(200).json({
        status: "success",
        message: `Cache for project ${projectId} invalidated successfully.`,
      } as ApiResponse);
    } catch (error) {
      return DashboardInsightsController.handleError(
        error as Error,
        res,
        "Failed to invalidate project cache"
      );
    }
  }
}
