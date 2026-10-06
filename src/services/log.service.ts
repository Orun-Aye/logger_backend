import {
  CreateLogDTO,
  FilterLogsDTO,
  LogLevel,
  LogSummaryData,
} from "../dtos/log.dto";
import {
  BatchLogDTO,
  BatchLogResponseDTO,
  ExportLogsQueryDTO,
} from "../dtos/savedSearch.dto";
import { LogModel, ILog } from "../models/log.model"; // Import ILog for type safety
import { ProjectModel } from "../models/project.model";
import { Types, SortOrder } from "mongoose";
import { globalServices } from "../server";
import { AlertService } from "./alert.service";
import { FingerprintService } from "./fingerprint.service";
import { ErrorGroupService } from "./errorGroup.service";
import { Readable } from "stream";

// Custom error classes for better error handling
export class LogNotFoundError extends Error {
  constructor(id: string) {
    super(`Log with ID ${id} not found`);
    this.name = "LogNotFoundError";
  }
}

export class LogServiceError extends Error {
  // Added context for more detailed errors, making it public for external use
  constructor(message: string, public context?: any) {
    super(message);
    this.name = "LogServiceError";
  }
}

export class LogValidationError extends Error {
  // New validation error class for input issues
  constructor(message: string) {
    super(message);
    this.name = "LogValidationError";
  }
}

/**
 * Escapes special regex characters in user input to prevent regex injection.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class LogService {
  /**
   * Validates if a given string is a valid MongoDB ObjectId.
   * Throws a LogValidationError if invalid.
   * @param id The string to validate.
   */
  private static validateObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new LogValidationError(`Invalid ID format: ${id}`);
    }
  }

  /**
   * Constructs a MongoDB query object based on provided log filters.
   * @param filters An object containing various criteria to filter logs.
   * @returns A MongoDB query object.
   */
  private static buildLogQuery(filters: FilterLogsDTO): any {
    const query: any = {};

    // Mandatory projectId filter for most operations
    if (filters.projectId) {
      this.validateObjectId(filters.projectId); // Validate project ID
      query.projectId = filters.projectId;
    }

    // Support both single level and multiple levels
    if (filters.levels && filters.levels.length > 0) {
      query.level = { $in: filters.levels };
    } else if (filters.level) {
      query.level = filters.level;
    }

    // Support both single service and multiple services
    if (filters.services && filters.services.length > 0) {
      query.service = { $in: filters.services };
    } else if (filters.service) {
      query.service = filters.service;
    }
    if (filters.environments && filters.environments.length > 0) {
      query.environment = { $in: filters.environments };
    } else if (filters.environment) {
      query.environment = filters.environment;
    }
    if (filters.eventTypes && filters.eventTypes.length > 0) {
      query.eventType = { $in: filters.eventTypes };
    } else if (filters.eventType) {
      query.eventType = filters.eventType;
    }

    // Use regex for partial matching on string fields like userAgent, url, referrer
    // All user inputs are escaped to prevent regex injection
    if (filters.userAgent)
      query.userAgent = { $regex: escapeRegex(filters.userAgent), $options: "i" };
    if (filters.url) query.url = { $regex: escapeRegex(filters.url), $options: "i" };
    if (filters.referrer)
      query.referrer = { $regex: escapeRegex(filters.referrer), $options: "i" };

    // Search for message and breadcrumb messages (case-insensitive regex)
    if (filters.search) {
      const searchRegex = { $regex: escapeRegex(filters.search), $options: "i" };
      query.$or = [
        { message: searchRegex },
        { "data.breadcrumbs.message": searchRegex },
      ];
    }

    // Search for error details (case-insensitive regex)
    if (filters.errorName)
      query["error.name"] = { $regex: escapeRegex(filters.errorName), $options: "i" };
    if (filters.errorMessage)
      query["error.message"] = { $regex: escapeRegex(filters.errorMessage), $options: "i" };

    // Date range for timestamp. Logs store timestamp as ISO string, so compare with ISO strings.
    // SDK Phase 2: Distributed tracing and release filters
    if (filters.traceId) query.traceId = filters.traceId;
    if (filters.spanId) query.spanId = filters.spanId;
    if (filters.release) query.release = filters.release;
    if (filters.correlationId) query.correlationId = filters.correlationId;
    if (filters.sessionId) query.sessionId = filters.sessionId;

    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate)
        query.timestamp.$gte = filters.startDate.toISOString();
      if (filters.endDate) query.timestamp.$lte = filters.endDate.toISOString();
    }

    return query;
  }

  /**
   * Bumps the project's stored log count and last-ingest time. Never throws:
   * a stale counter must not fail ingestion.
   */
  private static async recordIngestion(projectId: string, count: number): Promise<void> {
    if (count <= 0) return;
    try {
      // timestamps: false keeps updatedAt meaning "project settings changed"
      await ProjectModel.updateOne(
        { _id: projectId },
        { $inc: { logCount: count }, $set: { lastIngestedAt: new Date() } },
        { timestamps: false }
      );
    } catch (error) {
      console.error("LogService: failed to update project ingest stats:", error);
    }
  }

  /**
   * Creates a new log entry in the database.
   * @param data The data for the new log entry.
   * @param options.recordIngestion Set false when the caller updates the
   *   project's ingest stats itself (batchCreate does it once per batch).
   * @returns The created log document.
   * @throws LogValidationError if projectId is invalid.
   * @throws LogServiceError if creation fails. Identical logs are not
   *   deduplicated: the same message at the same timestamp is stored twice.
   */
  static async createLog(
    data: CreateLogDTO,
    options: { recordIngestion?: boolean } = {}
  ): Promise<ILog> {
    const ingestionStartTime = new Date();
    try {
      this.validateObjectId(data.projectId); // Validate projectId

      let normalizedTimestamp: Date | undefined;
      if (data.timestamp !== undefined && data.timestamp !== null) {
        if (data.timestamp instanceof Date) {
          normalizedTimestamp = data.timestamp;
        } else if (
          typeof data.timestamp === "string" ||
          typeof data.timestamp === "number"
        ) {
          const parsedDate = new Date(data.timestamp);
          // Check if parsing resulted in a valid date
          if (!isNaN(parsedDate.getTime())) {
            normalizedTimestamp = parsedDate;
          } else {
            // If provided timestamp is invalid, log a warning and proceed without it
            console.warn(
              `LogService: Invalid timestamp format provided: "${data.timestamp}". Using current timestamp`
            );
          }
        } else {
          // Handle cases where data.timestamp is neither Date, string, nor number
          console.warn(
            `LogService: Unexpected type for timestamp: "${typeof data.timestamp}". Using current timestamp`
          );
        }
      }

      const ingestionEndTime = new Date();
      const ingestionLatency = ingestionEndTime.getTime() - ingestionStartTime.getTime();

      // Prepare log data, ensuring timestamp is an ISO string
      const newLogData: Partial<ILog> = {
        ...data,
        timestamp: normalizedTimestamp
          ? normalizedTimestamp.toISOString()
          : new Date().toISOString(),
        ingestionStartTime,
        ingestionEndTime,
        ingestionLatency,
        ingestionSuccess: true,
      };

      // Phase 7: fingerprint error events so they can be grouped
      const isErrorEvent =
        data.level === "error" ||
        data.level === "fatal" ||
        data.eventType === "error";
      if (isErrorEvent && data.eventType !== "system") {
        newLogData.fingerprint = FingerprintService.compute({
          errorName: data.error?.name,
          message: data.error?.message || data.message,
          stack: data.error?.stack,
        });
      }

      const newLog = await LogModel.create(newLogData);

      if (options.recordIngestion !== false) {
        await this.recordIngestion(data.projectId, 1);
      }

      // Fire-and-forget alert evaluation to not block ingestion
      AlertService.evaluateLogAndTrigger(newLog.toObject() as ILog).catch(() => {});

      // Phase 7: fire-and-forget error-group rollup (new-group notifications)
      if (newLogData.fingerprint) {
        ErrorGroupService.recordError(newLog.toObject() as ILog).catch(() => {});
      }

      if (globalServices.dashboardWebSocketService) {
        globalServices.dashboardWebSocketService.broadcastToProject(
          data.projectId,
          "NEW_LOG",
          { log: newLog.toObject() }
        );
      }

      // Return the lean object (plain JS object) for performance
      return newLog.toObject() as ILog;
    } catch (error) {
      // Only record ingestion failure metrics for unexpected errors,
      // not for intentional duplicate rejections or validation errors
      if (
        !(error instanceof LogServiceError) &&
        !(error instanceof LogValidationError)
      ) {
        const ingestionEndTime = new Date();
        const ingestionLatency = ingestionEndTime.getTime() - ingestionStartTime.getTime();
        try {
          await LogModel.create({
            projectId: data.projectId,
            timestamp: new Date().toISOString(),
            level: 'error',
            message: 'Failed log ingestion',
            error: {
              name: error instanceof Error ? error.constructor.name : 'UnknownError',
              message: error instanceof Error ? error.message : 'Unknown error occurred',
            },
            eventType: 'system',
            ingestionStartTime,
            ingestionEndTime,
            ingestionLatency,
            ingestionSuccess: false,
            data: { originalLogData: data }
          });
        } catch (metricError) {
          console.error('Failed to record ingestion failure metric:', metricError);
        }
      }

      if (
        error instanceof LogValidationError ||
        error instanceof LogServiceError
      ) {
        throw error; // Re-throw custom errors directly
      }
      // Wrap generic errors in a custom service error for consistency
      throw new LogServiceError(
        `Failed to record log: ${(error as Error).message}`,
        { originalError: error, logData: data }
      );
    }
  }

  /**
   * Retrieves a paginated list of logs based on various filters.
   * @param filters An object containing filters and pagination options.
   * @returns An object containing the logs and pagination metadata.
   * @throws LogValidationError if projectId is missing or invalid.
   * @throws LogServiceError for other fetching failures.
   */
  static async getAllLogs(filters: FilterLogsDTO) {
    try {
      // Enforce projectId presence for this method to ensure project-scoped queries
      if (!filters.projectId) {
        throw new LogValidationError("projectId is required to fetch logs.");
      }

      return await this.findPage(this.buildLogQuery(filters), filters);
    } catch (error) {
      if (error instanceof LogValidationError) {
        throw error;
      }
      throw new LogServiceError(
        `Failed to fetch logs: ${(error as Error).message}`,
        { filters, originalError: error }
      );
    }
  }

  /**
   * Retrieves logs from every active project the user owns or is a team
   * member of, newest first. Backs the global Log Explorer.
   * @param userId The requesting user.
   * @param filters The same filters as getAllLogs; filters.projectId is ignored.
   * @param projectIds Optional subset to narrow to. IDs the user cannot access
   *   are dropped silently rather than rejected.
   * @throws LogValidationError if userId is invalid.
   * @throws LogServiceError for other fetching failures.
   */
  static async getLogsAcrossProjects(
    userId: string,
    filters: FilterLogsDTO,
    projectIds?: string[]
  ) {
    try {
      this.validateObjectId(userId);
      const userObjectId = new Types.ObjectId(userId);

      const accessible = await ProjectModel.find({
        isActive: true,
        $or: [{ ownerId: userObjectId }, { "teamMembers.user": userObjectId }],
      })
        .select("_id")
        .lean();

      let ids = accessible.map((project) => project._id.toString());
      if (projectIds && projectIds.length > 0) {
        const wanted = new Set(projectIds);
        ids = ids.filter((id) => wanted.has(id));
      }

      const query = this.buildLogQuery({ ...filters, projectId: undefined });
      query.projectId = { $in: ids };

      return await this.findPage(query, filters);
    } catch (error) {
      if (error instanceof LogValidationError) {
        throw error;
      }
      throw new LogServiceError(
        `Failed to fetch logs across projects: ${(error as Error).message}`,
        { userId, filters, originalError: error }
      );
    }
  }

  /** Runs a log query with the pagination and sort options from filters. */
  private static async findPage(query: any, filters: FilterLogsDTO) {
    const {
      page = 1,
      limit = 50,
      sortBy = "timestamp",
      sortOrder = "desc",
    } = filters;

    const skip = (page - 1) * limit;
    const sort: { [key: string]: SortOrder } = {
      [sortBy]: sortOrder === "asc" ? 1 : -1,
    };

    const [logs, total] = await Promise.all([
      LogModel.find(query)
        .select("-__v") // Exclude Mongoose version key
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(), // Use lean() for read operations for better performance
      LogModel.countDocuments(query), // Count based on the same query filters for accuracy
    ]);

    return {
      logs,
      pagination: {
        total: Math.ceil(total / limit),
        current: page,
        count: logs.length,
        order: sortOrder,
        totalRecords: total,
      },
    };
  }

  /**
   * Retrieves a single log entry by its ID.
   * @param id The ID of the log to retrieve.
   * @returns The log document.
   * @throws LogValidationError if the ID format is invalid.
   * @throws LogNotFoundError if the log is not found.
   * @throws LogServiceError for other fetching failures.
   */
  static async getLogById(id: string): Promise<ILog> {
    try {
      this.validateObjectId(id); // Use the new validation helper

      const log = await LogModel.findById(id).select("-__v").lean();

      if (!log) {
        throw new LogNotFoundError(id);
      }

      return log;
    } catch (error) {
      if (
        error instanceof LogNotFoundError ||
        error instanceof LogValidationError
      ) {
        throw error;
      }
      throw new LogServiceError(
        `Failed to fetch log: ${(error as Error).message}`,
        { logId: id, originalError: error }
      );
    }
  }

  /**
   * Generates a summary of log statistics for a given project.
   * @param projectId The ID of the project.
   * @param options Filtering options for the summary.
   * @returns A summary data object.
   * @throws LogValidationError if projectId is invalid.
   * @throws LogServiceError for aggregation failures.
   */
  static async getLogsSummary(
    projectId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      level?: LogLevel;
      service?: string;
      environment?: string;
      eventType?: ILog["eventType"];
    } = {}
  ): Promise<LogSummaryData> {
    try {
      this.validateObjectId(projectId);

      const startTime = Date.now(); // For response time calculation

      // Base match stage for all aggregations
      const baseMatch: any = { projectId };
      if (options.startDate)
        baseMatch.timestamp = { $gte: options.startDate.toISOString() };
      if (options.endDate) {
        baseMatch.timestamp = {
          ...baseMatch.timestamp,
          $lte: options.endDate.toISOString(),
        };
      }
      if (options.level) baseMatch.level = options.level;
      if (options.service) baseMatch.service = options.service;
      if (options.environment) baseMatch.environment = options.environment;
      if (options.eventType) baseMatch.eventType = options.eventType;

      const [
        totalLogs,
        byLevel,
        byService,
        byEnvironment,
        byEventType,
        topErrorMessages,
        recentLogCount,
      ] = await Promise.all([
        LogModel.countDocuments(baseMatch), // Total logs for the project with filters
        LogModel.aggregate([
          // Logs by level
          { $match: baseMatch },
          { $group: { _id: "$level", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        LogModel.aggregate([
          // Logs by service
          { $match: baseMatch },
          { $group: { _id: "$service", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 }, // Limit top 10 services
        ]),
        LogModel.aggregate([
          // Logs by environment
          { $match: baseMatch },
          { $group: { _id: "$environment", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 }, // Limit top 10 environments
        ]),
        LogModel.aggregate([
          // Logs by event type
          { $match: { ...baseMatch, eventType: { $exists: true, $ne: null } } }, // Only include logs with eventType
          { $group: { _id: "$eventType", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 }, // Limit top 10 event types
        ]),
        LogModel.aggregate([
          // Top 5 error messages
          {
            $match: {
              ...baseMatch,
              level: LogLevel.ERROR,
              "error.message": { $exists: true, $nin: [null, ""] },
            },
          },
          {
            $group: {
              _id: "$error.message",
              count: { $sum: 1 },
              lastSeen: { $max: "$timestamp" },
            },
          },
          { $sort: { count: -1, lastSeen: -1 } }, // Sort by count then by most recent
          { $limit: 5 },
          { $project: { _id: 0, message: "$_id", count: 1, lastSeen: 1 } }, // Reshape output
        ]),
        LogModel.countDocuments({
          // Recent logs (last 24 hours)
          ...baseMatch,
          timestamp: {
            $gte: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          },
        }),
      ]);

      const endTime = Date.now();

      return {
        totalLogs,
        byLevel: Object.fromEntries(
          byLevel.map((l) => [l._id, l.count])
        ) as Record<LogLevel, number>,
        byService: Object.fromEntries(byService.map((s) => [s._id, s.count])),
        byEnvironment: Object.fromEntries(
          byEnvironment.map((e) => [e._id, e.count])
        ),
        byEventType: Object.fromEntries(
          byEventType.map((e) => [e._id, e.count])
        ),
        topErrorMessages: topErrorMessages,
        recentLogCount: recentLogCount,
        metadata: {
          projectId,
          filters: options,
          generatedAt: new Date(),
          responseTime: endTime - startTime,
        },
      };
    } catch (error) {
      if (error instanceof LogValidationError) {
        throw error;
      }
      throw new LogServiceError(
        `Failed to get log summary: ${(error as Error).message}`,
        { projectId, options, originalError: error }
      );
    }
  }

  /**
   * Retrieves log volume trends over time for a given project.
   * @param projectId The ID of the project.
   * @param options Filtering and grouping options for the trends.
   * @returns An object containing the trends data and metadata.
   * @throws LogValidationError if projectId is invalid.
   * @throws LogServiceError for aggregation failures.
   */
  static async getLogTrends(
    projectId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      groupBy?: "hour" | "day" | "week" | "month";
      level?: LogLevel;
      service?: string;
      environment?: string;
      eventType?: ILog["eventType"];
    } = {}
  ): Promise<{
    trends: Array<{
      _id: string;
      count: number;
      errorCount?: number;
      warnCount?: number;
    }>;
    metadata: any;
  }> {
    try {
      this.validateObjectId(projectId);
      const {
        startDate,
        endDate,
        groupBy = "day",
        level,
        service,
        environment,
        eventType,
      } = options;

      const matchStage: any = { projectId };
      if (startDate || endDate) {
        matchStage.timestamp = {};
        if (startDate) matchStage.timestamp.$gte = startDate.toISOString();
        if (endDate) matchStage.timestamp.$lte = endDate.toISOString();
      }
      if (level) matchStage.level = level;
      if (service) matchStage.service = service;
      if (environment) matchStage.environment = environment;
      if (eventType) matchStage.eventType = eventType;

      let format: string;
      switch (groupBy) {
        case "hour":
          format = "%Y-%m-%dT%H"; // YYYY-MM-DDTHH
          break;
        case "day":
          format = "%Y-%m-%d"; // YYYY-MM-DD
          break;
        case "week":
          format = "%Y-%U"; // YYYY-WeekNumber
          break;
        case "month":
          format = "%Y-%m"; // YYYY-MM
          break;
        default:
          format = "%Y-%m-%d";
      }

      const trends = await LogModel.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: { $dateToString: { format, date: { $toDate: "$timestamp" } } }, // Convert ISO string to Date for date aggregation
            count: { $sum: 1 },
            errorCount: {
              $sum: { $cond: [{ $eq: ["$level", LogLevel.ERROR] }, 1, 0] },
            },
            warnCount: {
              $sum: { $cond: [{ $eq: ["$level", LogLevel.WARN] }, 1, 0] },
            },
          },
        },
        { $sort: { _id: 1 } }, // Sort by the aggregated date/time
      ]);

      return {
        trends,
        metadata: {
          projectId,
          filters: options,
          generatedAt: new Date(),
        },
      };
    } catch (error) {
      if (error instanceof LogValidationError) {
        throw error;
      }
      throw new LogServiceError(
        `Failed to get log trends: ${(error as Error).message}`,
        { projectId, options, originalError: error }
      );
    }
  }

  /**
   * Deletes logs based on provided filters.
   * IMPORTANT: Requires projectId and at least one additional filter to prevent accidental mass deletion.
   * @param filters Filters to apply for deletion.
   * @returns An object with the count of deleted documents.
   * @throws LogValidationError if projectId is missing or filters are too broad.
   * @throws LogServiceError for deletion failures.
   */
  static async deleteLogs(
    filters: FilterLogsDTO
  ): Promise<{ deletedCount: number }> {
    try {
      // Enforce projectId for deletion operations
      if (!filters.projectId) {
        throw new LogValidationError("projectId is required to delete logs.");
      }

      const query = this.buildLogQuery(filters);

      // Safeguard: Prevent deleting all logs for a project without specific filters.
      // This checks if the only filter present is projectId.
      if (Object.keys(query).length === 1 && query.projectId) {
        throw new LogValidationError(
          "Refine filters to prevent deleting all logs for a project. At least one additional filter (e.g., level, startDate, search, eventType) is required for bulk deletion."
        );
      }

      const result = await LogModel.deleteMany(query);
      return { deletedCount: result.deletedCount || 0 };
    } catch (error) {
      if (error instanceof LogValidationError) {
        throw error;
      }
      throw new LogServiceError(
        `Failed to delete logs: ${(error as Error).message}`,
        { filters, originalError: error }
      );
    }
  }

  /**
   * Retrieves distinct values for a specified field within a given project.
   * Useful for populating filter dropdowns in UI.
   * @param projectId The ID of the project.
   * @param field The field for which to get distinct values.
   * @returns An array of distinct string values.
   * @throws LogValidationError if projectId is invalid.
   * @throws LogServiceError for database errors.
   */
  static async getDistinctValues(
    projectId: string,
    field:
      | "level"
      | "service"
      | "environment"
      | "eventType"
      | "url"
      | "userAgent"
      | "error.name"
  ): Promise<string[]> {
    try {
      this.validateObjectId(projectId);
      const distinctValues = await LogModel.distinct(field, { projectId });
      // Filter out any null, undefined, or empty string values that might exist
      return distinctValues.filter(Boolean) as string[];
    } catch (error) {
      if (error instanceof LogValidationError) {
        throw error;
      }
      throw new LogServiceError(
        `Failed to get distinct values for field '${field}': ${
          (error as Error).message
        }`,
        { projectId, field, originalError: error }
      );
    }
  }

  /**
   * Retrieves a paginated list of unique error messages for a project.
   * @param projectId The ID of the project.
   * @param options Pagination and search options.
   * @returns An object containing unique error messages and pagination metadata.
   * @throws LogValidationError if projectId is invalid.
   * @throws LogServiceError for aggregation failures.
   */
  static async getUniqueErrorMessages(
    projectId: string,
    options: { page?: number; limit?: number; search?: string } = {}
  ) {
    try {
      this.validateObjectId(projectId);
      const { page = 1, limit = 10, search } = options;
      const skip = (page - 1) * limit;

      // Match stage to filter by project, error level, and ensure error message exists
      const matchStage: any = {
        projectId,
        level: LogLevel.ERROR,
        "error.message": { $exists: true, $nin: [null, ""] },
      };
      if (search) {
        matchStage["error.message"] = { $regex: escapeRegex(search), $options: "i" };
      }

      const [uniqueMessages, totalCountResult] = await Promise.all([
        LogModel.aggregate([
          { $match: matchStage },
          {
            $group: {
              _id: "$error.message",
              count: { $sum: 1 },
              lastSeen: { $max: "$timestamp" },
            },
          },
          { $sort: { lastSeen: -1 } }, // Sort by most recently seen error
          { $skip: skip },
          { $limit: limit },
          { $project: { message: "$_id", count: 1, lastSeen: 1, _id: 0 } }, // Reshape output
        ]),
        LogModel.aggregate([
          { $match: matchStage },
          { $group: { _id: "$error.message" } }, // Group to count unique messages
          { $count: "count" }, // Count the number of unique messages
        ]),
      ]);

      const totalRecords =
        totalCountResult.length > 0 ? totalCountResult[0].count : 0;

      return {
        messages: uniqueMessages,
        pagination: {
          total: Math.ceil(totalRecords / limit),
          current: page,
          count: uniqueMessages.length,
          totalRecords: totalRecords,
        },
      };
    } catch (error) {
      if (error instanceof LogValidationError) {
        throw error;
      }
      throw new LogServiceError(
        `Failed to get unique error messages: ${(error as Error).message}`,
        { projectId, options, originalError: error }
      );
    }
  }

  /**
   * Batch create multiple log entries in a single operation.
   * @param projectId The ID of the project for all logs.
   * @param data The batch log data containing an array of logs.
   * @returns A response object with success/failure counts and individual results.
   * @throws LogValidationError if projectId is invalid or batch size exceeds limits.
   * @throws LogServiceError for other processing failures.
   */
  static async batchCreate(
    projectId: string,
    data: BatchLogDTO
  ): Promise<BatchLogResponseDTO> {
    try {
      this.validateObjectId(projectId);

      if (data.logs.length === 0) {
        throw new LogValidationError("Batch must contain at least one log entry");
      }

      if (data.logs.length > 100) {
        throw new LogValidationError("Batch size cannot exceed 100 logs");
      }

      const results: BatchLogResponseDTO["results"] = [];
      let successCount = 0;
      let failedCount = 0;

      // Process each log entry individually
      for (let i = 0; i < data.logs.length; i++) {
        const logEntry = data.logs[i];
        try {
          const logData: CreateLogDTO = {
            projectId,
            timestamp: logEntry.timestamp,
            level: logEntry.level as LogLevel,
            message: logEntry.message,
            data: logEntry.data,
            error: logEntry.error,
            service: logEntry.service,
            environment: logEntry.environment,
            context: logEntry.context,
            metadata: logEntry.metadata,
            eventType: logEntry.eventType as ILog["eventType"],
            userAgent: logEntry.userAgent,
            url: logEntry.url,
            referrer: logEntry.referrer,
            correlationId: logEntry.correlationId,
            sessionId: logEntry.sessionId,
            traceId: logEntry.traceId,
            spanId: logEntry.spanId,
            release: logEntry.release,
          };

          const createdLog = await this.createLog(logData, {
            recordIngestion: false,
          });
          successCount++;
          results.push({
            index: i,
            success: true,
            logId: createdLog._id.toString(),
          });
        } catch (error) {
          failedCount++;
          results.push({
            index: i,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      await this.recordIngestion(projectId, successCount);

      return {
        success: successCount,
        failed: failedCount,
        results,
      };
    } catch (error) {
      if (error instanceof LogValidationError) {
        throw error;
      }
      throw new LogServiceError(
        `Failed to process batch logs: ${(error as Error).message}`,
        { projectId, batchSize: data.logs.length, originalError: error }
      );
    }
  }

  /**
   * Perform a structured query search on logs using a query string format.
   * Query syntax: "level:error service:api message:timeout"
   * @param projectId The ID of the project.
   * @param query The structured query string.
   * @param page Page number for pagination.
   * @param limit Number of results per page.
   * @returns An object containing the logs and pagination metadata.
   * @throws LogValidationError if projectId is invalid.
   * @throws LogServiceError for search failures.
   */
  static async structuredSearch(
    projectId: string,
    query: string,
    page: number = 1,
    limit: number = 100
  ) {
    try {
      this.validateObjectId(projectId);

      // Parse the structured query string
      const filters: FilterLogsDTO = { projectId, page, limit };

      // Split query by spaces but preserve quoted strings
      const tokens = query.match(/(?:[^\s"]+|"[^"]*")+/g) || [];

      for (const token of tokens) {
        const colonIndex = token.indexOf(":");
        if (colonIndex === -1) {
          // No colon, treat as general search term
          if (!filters.search) {
            filters.search = token.replace(/"/g, "");
          }
          continue;
        }

        const field = token.substring(0, colonIndex).toLowerCase();
        const value = token.substring(colonIndex + 1).replace(/"/g, "");

        switch (field) {
          case "level":
            if (!filters.levels) filters.levels = [];
            filters.levels.push(value as LogLevel);
            break;
          case "service":
            if (!filters.services) filters.services = [];
            filters.services.push(value);
            break;
          case "environment":
            filters.environment = value;
            break;
          case "eventtype":
          case "event":
            filters.eventType = value as ILog["eventType"];
            break;
          case "message":
          case "search":
            filters.search = value;
            break;
          case "error":
            filters.errorMessage = value;
            break;
          case "errorname":
            filters.errorName = value;
            break;
          case "url":
            filters.url = value;
            break;
          case "useragent":
            filters.userAgent = value;
            break;
          case "referrer":
            filters.referrer = value;
            break;
          default:
            // Unknown field, ignore or treat as search term
            if (!filters.search) {
              filters.search = token;
            }
            break;
        }
      }

      // Use the existing getAllLogs method with the parsed filters
      return await this.getAllLogs(filters);
    } catch (error) {
      if (error instanceof LogValidationError) {
        throw error;
      }
      throw new LogServiceError(
        `Failed to execute structured search: ${(error as Error).message}`,
        { projectId, query, originalError: error }
      );
    }
  }

  /**
   * Export logs to CSV or JSON format with streaming support.
   * @param projectId The ID of the project.
   * @param options Export options including format and filters.
   * @returns A readable stream of the exported data.
   * @throws LogValidationError if projectId is invalid.
   * @throws LogServiceError for export failures.
   */
  static async exportLogs(
    projectId: string,
    options: ExportLogsQueryDTO
  ): Promise<Readable> {
    try {
      this.validateObjectId(projectId);

      const {
        format,
        levels,
        services,
        environments,
        search,
        startDate,
        endDate,
        limit = 10000,
      } = options;

      // Build query filters
      const filters: FilterLogsDTO = {
        projectId,
        levels: levels as LogLevel[] | undefined,
        services,
        environment: environments?.[0], // Take first environment if provided
        search,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      };

      const query = this.buildLogQuery(filters);

      // Create a cursor for streaming results
      const cursor = LogModel.find(query)
        .select("-__v")
        .sort({ timestamp: -1 })
        .limit(limit)
        .cursor();

      if (format === "csv") {
        return this.createCSVStream(cursor);
      } else {
        return this.createJSONStream(cursor);
      }
    } catch (error) {
      if (error instanceof LogValidationError) {
        throw error;
      }
      throw new LogServiceError(
        `Failed to export logs: ${(error as Error).message}`,
        { projectId, options, originalError: error }
      );
    }
  }

  /**
   * Creates a readable stream that outputs logs in CSV format.
   * @param cursor MongoDB cursor for streaming documents.
   * @returns A readable stream of CSV data.
   */
  private static createCSVStream(cursor: any): Readable {
    let headerWritten = false;

    const stream = new Readable({
      async read() {
        try {
          const doc = await cursor.next();

          if (!doc) {
            this.push(null); // End of stream
            return;
          }

          // Write CSV header on first row
          if (!headerWritten) {
            const headers = [
              "timestamp",
              "level",
              "message",
              "service",
              "environment",
              "eventType",
              "url",
              "userAgent",
              "error.name",
              "error.message",
              "error.stack",
              "correlationId",
              "sessionId",
              "traceId",
              "spanId",
              "release",
            ].join(",");
            this.push(headers + "\n");
            headerWritten = true;
          }

          // Escape CSV values: handles commas, quotes, newlines, and carriage returns
          const escape = (val: any): string => {
            if (val === undefined || val === null) return "";
            const str = String(val);
            if (
              str.includes(",") ||
              str.includes('"') ||
              str.includes("\n") ||
              str.includes("\r")
            ) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          };

          const row = [
            escape(doc.timestamp),
            escape(doc.level),
            escape(doc.message),
            escape(doc.service),
            escape(doc.environment),
            escape(doc.eventType),
            escape(doc.url),
            escape(doc.userAgent),
            escape(doc.error?.name),
            escape(doc.error?.message),
            escape(doc.error?.stack),
            escape(doc.correlationId),
            escape(doc.sessionId),
            escape(doc.traceId),
            escape(doc.spanId),
            escape(doc.release),
          ].join(",");

          this.push(row + "\n");
        } catch (error) {
          this.destroy(error as Error);
        }
      },
    });

    return stream;
  }

  /**
   * Creates a readable stream that outputs logs in JSON format.
   * @param cursor MongoDB cursor for streaming documents.
   * @returns A readable stream of JSON data.
   */
  private static createJSONStream(cursor: any): Readable {
    let first = true;

    const stream = new Readable({
      async read() {
        try {
          const doc = await cursor.next();

          if (!doc) {
            this.push("]"); // Close JSON array
            this.push(null); // End of stream
            return;
          }

          if (first) {
            this.push("["); // Start JSON array
            first = false;
          } else {
            this.push(","); // Separator between JSON objects
          }

          this.push(JSON.stringify(doc));
        } catch (error) {
          this.destroy(error as Error);
        }
      },
    });

    return stream;
  }
}
