// src/controllers/log.controller.ts

import { Request, Response } from "express";
import {
  LogNotFoundError,
  LogService,
  LogServiceError,
  LogValidationError, // Import new error class
} from "../services/log.service";
import { FilterLogsDTO, LogLevel, LogSortByField, CreateLogDTO } from "../dtos/log.dto"; // Ensure CreateLogDTO is imported
import { SortOrder } from "mongoose"; // SortOrder is from mongoose, not strictly needed in DTO but fine here

interface ApiResponse<T = any> {
  status: "success" | "error";
  message?: string;
  data?: T;
  errors?: string[];
  meta?: any;
}

export class LogController {
  private static handleError(
    error: Error,
    res: Response,
    defaultMessage: string
  ): Response {
    console.error(`LogController Error: ${error.message}`, error.stack);

    if (error instanceof LogValidationError) { // Handle validation errors specifically
      return res.status(400).json({
        status: "error",
        message: error.message,
        errors: [error.message],
      } as ApiResponse);
    }

    if (error instanceof LogNotFoundError) {
      return res.status(404).json({
        status: "error",
        message: error.message,
      } as ApiResponse);
    }

    if (error instanceof LogServiceError) { // Catch other service-specific errors
        // LogServiceError can carry context, which might be useful for debugging
        const errors = error.context ? [`${error.message} (Context: ${JSON.stringify(error.context)})`] : [error.message];
        return res.status(500).json({ // Changed to 500 as it's a service operation error
            status: "error",
            message: error.message,
            errors: errors,
        } as ApiResponse);
    }

    // Database/MongoDB specific errors
    if (error.name === "ValidationError") { // Mongoose validation error
      return res.status(400).json({
        status: "error",
        message: "Validation failed",
        errors: Object.values((error as any).errors).map(
          (err: any) => err.message
        ),
      } as ApiResponse);
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        status: "error",
        message: "Invalid ID format",
      } as ApiResponse);
    }

    // Generic server error
    return res.status(500).json({
      status: "error",
      message: defaultMessage,
    } as ApiResponse);
  }

  // Updated to accept projectId as a parameter, as most log operations are project-scoped
  private static validatePaginationAndFilterParams(req: Request, projectId?: string): FilterLogsDTO {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit as string) || 10)
    ); // Cap at 100

    const allowedSortBy: LogSortByField[] = [
      "timestamp",
      "level",
      "service",
      "environment",
      "createdAt",
      "updatedAt",
      "eventType", // New
      "url",       // New
    ];

    let sortBy: LogSortByField = "timestamp"; // Default to timestamp as it's most common for logs
    if (
      req.query.sortBy &&
      typeof req.query.sortBy === "string" &&
      allowedSortBy.includes(req.query.sortBy as LogSortByField)
    ) {
      sortBy = req.query.sortBy as LogSortByField;
    }

    const sortOrder: SortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";

    const level =
      typeof req.query.level === "string" &&
      Object.values(LogLevel).includes(req.query.level as LogLevel)
        ? (req.query.level as LogLevel)
        : undefined;

    // Support multiple levels (e.g., ?levels=error&levels=warn)
    let levels: LogLevel[] | undefined;
    if (req.query.levels) {
      const levelsParam = Array.isArray(req.query.levels)
        ? req.query.levels
        : [req.query.levels];
      levels = levelsParam.filter(
        (l): l is LogLevel => typeof l === "string" && Object.values(LogLevel).includes(l as LogLevel)
      ) as LogLevel[];
      if (levels.length === 0) levels = undefined;
    }

    const service = typeof req.query.service === "string" ? req.query.service : undefined;

    // Support multiple services (e.g., ?services=api&services=web)
    let services: string[] | undefined;
    if (req.query.services) {
      const servicesParam = Array.isArray(req.query.services)
        ? req.query.services
        : [req.query.services];
      services = servicesParam.filter((s): s is string => typeof s === "string");
      if (services.length === 0) services = undefined;
    }
    const environment = typeof req.query.environment === "string" ? req.query.environment : undefined;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;

    const startDate =
      typeof req.query.startDate === "string"
        ? new Date(req.query.startDate)
        : undefined;
    const endDate =
      typeof req.query.endDate === "string"
        ? new Date(req.query.endDate)
        : undefined;

    // New fields from LogModel and FilterLogsDTO
    const eventType = typeof req.query.eventType === "string" ? req.query.eventType as FilterLogsDTO['eventType'] : undefined;
    const userAgent = typeof req.query.userAgent === "string" ? req.query.userAgent : undefined;
    const url = typeof req.query.url === "string" ? req.query.url : undefined;
    const referrer = typeof req.query.referrer === "string" ? req.query.referrer : undefined;
    const errorName = typeof req.query.errorName === "string" ? req.query.errorName : undefined;
    const errorMessage = typeof req.query.errorMessage === "string" ? req.query.errorMessage : undefined;


    return {
      projectId: projectId, // Pass projectId from the route parameter
      page,
      limit,
      sortBy,
      sortOrder,
      level,
      levels,
      service,
      services,
      environment,
      search,
      startDate,
      endDate,
      eventType,
      userAgent,
      url,
      referrer,
      errorName,
      errorMessage,
    };
  }

  // --- Core Log Operations ---

  static async createLog(req: Request, res: Response): Promise<Response> {
    try {
      // Assuming projectId comes from req.params as /projects/:projectId/logs
      const { projectId } = req.params;
      const logData: CreateLogDTO = { ...req.body, projectId };

      // Basic validation for required fields in the body
      if (!logData.level || !logData.message) {
        return res.status(400).json({
          status: "error",
          message: "Log level and message are required.",
        } as ApiResponse);
      }

      const log = await LogService.createLog(logData);

      return res.status(201).json({
        status: "success",
        message: "Log entry created successfully",
        data: log,
      } as ApiResponse);
    } catch (error) {
      return LogController.handleError(
        error as Error,
        res,
        "Failed to create log entry"
      );
    }
  }

  static async getAllLogs(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params; // Get projectId from route params
      const filters = LogController.validatePaginationAndFilterParams(req, projectId); // Pass projectId to helper

      const result = await LogService.getAllLogs(filters);

      return res.status(200).json({
        status: "success",
        message: "Logs fetched successfully",
        data: result.logs,
        meta: {
          pagination: result.pagination,
          filters: filters, // Include all applied filters in meta for clarity
        },
      } as ApiResponse);
    } catch (error) {
      return LogController.handleError(
        error as Error,
        res,
        "Failed to fetch logs"
      );
    }
  }

  static async getLogById(req: Request, res: Response): Promise<Response> {
    try {
      const { logId } = req.params; // Assuming route is /logs/:logId or /projects/:projectId/logs/:logId
      const log = await LogService.getLogById(logId);

      return res.status(200).json({
        status: "success",
        message: "Log fetched successfully",
        data: log,
      } as ApiResponse);
    } catch (error) {
      return LogController.handleError(
        error as Error,
        res,
        "Failed to fetch log"
      );
    }
  }

  // --- Log Analytics and Summaries ---

  static async getLogsSummary(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { startDate, endDate, level, service, environment, eventType } = req.query;

      const options = {
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        level: level as LogLevel | undefined,
        service: service as string | undefined,
        environment: environment as string | undefined,
        eventType: eventType as FilterLogsDTO['eventType'] | undefined,
      };

      const summary = await LogService.getLogsSummary(projectId, options);

      return res.status(200).json({
        status: "success",
        message: "Log summary fetched successfully",
        data: summary,
        meta: summary.metadata,
      } as ApiResponse);
    } catch (error) {
      return LogController.handleError(
        error as Error,
        res,
        "Failed to fetch log summary"
      );
    }
  }

  static async getLogTrends(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { startDate, endDate, groupBy, level, service, environment, eventType } = req.query;

      const options = {
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        groupBy: groupBy as "hour" | "day" | "week" | "month" | undefined,
        level: level as LogLevel | undefined,
        service: service as string | undefined,
        environment: environment as string | undefined,
        eventType: eventType as FilterLogsDTO['eventType'] | undefined,
      };

      const trends = await LogService.getLogTrends(projectId, options);

      return res.status(200).json({
        status: "success",
        message: "Log trends fetched successfully",
        data: trends.trends,
        meta: trends.metadata,
      } as ApiResponse);
    } catch (error) {
      return LogController.handleError(
        error as Error,
        res,
        "Failed to fetch log trends"
      );
    }
  }

  // --- Log Deletion ---

  static async deleteLogs(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params; // projectId is required for deletion
      const filters = LogController.validatePaginationAndFilterParams(req, projectId); // Use existing helper for filters

      // IMPORTANT: Ensure filters are not empty beyond projectId to prevent accidental mass deletion.
      // The service layer already has a safeguard, but adding a controller-level check is good practice.
      const filterKeys = Object.keys(filters).filter(key => key !== 'projectId' && filters[key as keyof FilterLogsDTO] !== undefined);
      if (filterKeys.length === 0) {
        return res.status(400).json({
          status: "error",
          message: "At least one specific filter (e.g., level, search, startDate, eventType) is required for log deletion to prevent accidental mass deletion.",
        } as ApiResponse);
      }

      const result = await LogService.deleteLogs(filters);

      return res.status(200).json({
        status: "success",
        message: `Successfully deleted ${result.deletedCount} log entries.`,
        data: { deletedCount: result.deletedCount },
      } as ApiResponse);
    } catch (error) {
      return LogController.handleError(
        error as Error,
        res,
        "Failed to delete logs"
      );
    }
  }

  // --- Utility Methods for UI Filters ---

  static async getDistinctValues(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId, field } = req.params; // field will be a path param like /distinct-values/:field
      const allowedFields: Parameters<typeof LogService.getDistinctValues>[1][] = [
        "level", "service", "environment", "eventType", "url", "userAgent", "error.name"
      ];

      if (!field || !allowedFields.includes(field as any)) {
        return res.status(400).json({
          status: "error",
          message: `Invalid or missing field parameter. Allowed fields are: ${allowedFields.join(", ")}`,
        } as ApiResponse);
      }

      const distinctValues = await LogService.getDistinctValues(projectId, field as Parameters<typeof LogService.getDistinctValues>[1]);

      return res.status(200).json({
        status: "success",
        message: `Distinct values for '${field}' fetched successfully`,
        data: distinctValues,
      } as ApiResponse);
    } catch (error) {
      return LogController.handleError(
        error as Error,
        res,
        `Failed to fetch distinct values for field '${req.params.field}'`
      );
    }
  }

  static async getUniqueErrorMessages(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { page, limit, search } = req.query;

      const options = {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string | undefined,
      };

      const result = await LogService.getUniqueErrorMessages(projectId, options);

      return res.status(200).json({
        status: "success",
        message: "Unique error messages fetched successfully",
        data: result.messages,
        meta: result.pagination,
      } as ApiResponse);
    } catch (error) {
      return LogController.handleError(
        error as Error,
        res,
        "Failed to fetch unique error messages"
      );
    }
  }

  // --- Batch Operations ---

  static async batchCreateLogs(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const batchData = req.body; // BatchLogDTO

      if (!batchData.logs || !Array.isArray(batchData.logs)) {
        return res.status(400).json({
          status: "error",
          message: "Request body must contain a 'logs' array",
        } as ApiResponse);
      }

      const result = await LogService.batchCreate(projectId, batchData);

      return res.status(201).json({
        status: "success",
        message: `Batch processing complete: ${result.success} succeeded, ${result.failed} failed`,
        data: result,
      } as ApiResponse);
    } catch (error) {
      return LogController.handleError(
        error as Error,
        res,
        "Failed to process batch log creation"
      );
    }
  }

  // --- Advanced Search ---

  static async structuredSearch(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { query } = req.body;

      if (!query || typeof query !== "string") {
        return res.status(400).json({
          status: "error",
          message: "Request body must contain a 'query' string field",
        } as ApiResponse);
      }

      const page = Math.max(1, parseInt(req.body.page as string) || 1);
      const limit = Math.min(
        1000,
        Math.max(1, parseInt(req.body.limit as string) || 100)
      );

      const result = await LogService.structuredSearch(projectId, query, page, limit);

      return res.status(200).json({
        status: "success",
        message: "Structured search executed successfully",
        data: result.logs,
        meta: {
          pagination: result.pagination,
          query: query,
        },
      } as ApiResponse);
    } catch (error) {
      return LogController.handleError(
        error as Error,
        res,
        "Failed to execute structured search"
      );
    }
  }

  // --- Export Operations ---

  static async exportLogs(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const exportOptions = req.body; // ExportLogsQueryDTO

      if (!exportOptions.format || !["csv", "json"].includes(exportOptions.format)) {
        res.status(400).json({
          status: "error",
          message: "Export format must be either 'csv' or 'json'",
        } as ApiResponse);
        return;
      }

      const stream = await LogService.exportLogs(projectId, exportOptions);

      // Set appropriate headers for file download
      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `logs-${projectId}-${timestamp}.${exportOptions.format}`;
      const contentType =
        exportOptions.format === "csv"
          ? "text/csv"
          : "application/json";

      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Transfer-Encoding", "chunked");

      // Pipe the stream to the response
      stream.pipe(res);

      stream.on("error", (error) => {
        console.error("Export stream error:", error);
        if (!res.headersSent) {
          res.status(500).json({
            status: "error",
            message: "Failed to export logs",
          } as ApiResponse);
        }
      });
    } catch (error) {
      if (!res.headersSent) {
        LogController.handleError(
          error as Error,
          res,
          "Failed to export logs"
        );
      }
    }
  }
}