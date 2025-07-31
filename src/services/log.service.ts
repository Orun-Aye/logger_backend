import {
  CreateLogDTO,
  FilterLogsDTO,
  LogLevel,
  LogSummaryData,
} from "../dtos/log.dto";
import { LogModel, ILog } from "../models/log.model"; // Import ILog for type safety
import { Types, SortOrder } from "mongoose";

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

    if (filters.level) query.level = filters.level;
    if (filters.service) query.service = filters.service;
    if (filters.environment) query.environment = filters.environment;
    if (filters.eventType) query.eventType = filters.eventType;

    // Use regex for partial matching on string fields like userAgent, url, referrer
    if (filters.userAgent)
      query.userAgent = { $regex: filters.userAgent, $options: "i" };
    if (filters.url) query.url = { $regex: filters.url, $options: "i" };
    if (filters.referrer)
      query.referrer = { $regex: filters.referrer, $options: "i" };

    // Search for message (case-insensitive regex)
    if (filters.search)
      query.message = { $regex: filters.search, $options: "i" };

    // Search for error details (case-insensitive regex)
    if (filters.errorName)
      query["error.name"] = { $regex: filters.errorName, $options: "i" };
    if (filters.errorMessage)
      query["error.message"] = { $regex: filters.errorMessage, $options: "i" };

    // Date range for timestamp. Logs store timestamp as ISO string, so compare with ISO strings.
    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate)
        query.timestamp.$gte = filters.startDate.toISOString();
      if (filters.endDate) query.timestamp.$lte = filters.endDate.toISOString();
    }

    return query;
  }

  /**
   * Creates a new log entry in the database.
   * @param data The data for the new log entry.
   * @returns The created log document.
   * @throws LogValidationError if projectId is invalid.
   * @throws LogServiceError if a duplicate log exists or other creation fails.
   */
  static async createLog(data: CreateLogDTO): Promise<ILog> {
    try {
      this.validateObjectId(data.projectId); // Validate projectId

      let normalizedTimestamp: Date | undefined;
      if (data.timestamp !== undefined && data.timestamp !== null) {
        if (data.timestamp instanceof Date) {
          normalizedTimestamp = data.timestamp
        } else if (typeof data.timestamp === "string" || typeof data.timestamp === "number") {
          const parsedDate = new Date(data.timestamp)
          // Check if parsing resulted in a valid date
          if (!isNaN(parsedDate.getTime())) {
            normalizedTimestamp = parsedDate
          } else {
            // If provided timestamp is invalid, log a warning and proceed without it
            console.warn(`LogService: Invalid timestamo format provided: "${data.timestamp}". Using current timestamp`);

          }
        } else {
          // Handle cases where data.timestamp is neither Date, string, nor number
          console.warn(`LogService: Unexpected type for timestamp: "${typeof data.timestamp}". Using current timestamp`)
        }
      }

      // IMPORTANT: Re-evaluate this duplicate check for production logging.
      // For high-volume logging, checking for exact duplicates (projectId, message, timestamp)
      // can be a performance bottleneck and might prevent legitimate, slightly different logs.
      // If true deduplication is needed, consider a more robust fingerprinting approach.
      // For now, keeping it as per original logic, but with a warning.
      const existingLog = await LogModel.findOne({
        projectId: data.projectId,
        message: data.message,
        // Ensure timestamp is an ISO string for comparison as per schema
        timestamp: normalizedTimestamp ? normalizedTimestamp.toISOString() : undefined,
      });

      if (existingLog) {
        throw new LogServiceError(
          "Log entry with the same project, message, and timestamp already exists. Consider if this is the desired behavior for log deduplication.",
          { logData: data, existingLogId: existingLog._id }
        );
      }

      // Prepare log data, ensuring timestamp is an ISO string
      const newLogData: Partial<ILog> = {
        ...data,
        timestamp: normalizedTimestamp
          ? normalizedTimestamp.toISOString()
          : new Date().toISOString(),
      };

      const newLog = await LogModel.create(newLogData);

      // Return the lean object (plain JS object) for performance
      return newLog.toObject() as ILog;
    } catch (error) {
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

      const {
        page = 1,
        limit = 50,
        sortBy = "timestamp",
        sortOrder = "desc",
      } = filters;

      const query = this.buildLogQuery(filters);
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
              "error.message": { $exists: true, $nin:[ null, ""] },
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
        matchStage["error.message"] = { $regex: search, $options: "i" };
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
}
