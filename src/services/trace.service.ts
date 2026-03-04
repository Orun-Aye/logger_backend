// src/services/trace.service.ts

import { LogModel } from "../models/log.model";
import { Types } from "mongoose";

/**
 * Custom error for trace service validation issues.
 */
export class TraceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TraceValidationError";
  }
}

/**
 * Custom error for trace service operation failures.
 */
export class TraceServiceError extends Error {
  constructor(message: string, public context?: any) {
    super(message);
    this.name = "TraceServiceError";
  }
}

/**
 * Filters for listing traces.
 */
interface TraceListFilters {
  startDate?: Date;
  endDate?: Date;
  minDuration?: number;
  status?: "ok" | "error";
  service?: string;
  page: number;
  limit: number;
  sortBy: "startTime" | "duration" | "spanCount";
  sortOrder: "asc" | "desc";
}

/**
 * TraceService - Provides distributed tracing functionality by aggregating
 * log entries that share traceId and spanId fields.
 */
export class TraceService {
  /**
   * Validates that a string is a valid MongoDB ObjectId.
   */
  private static validateObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new TraceValidationError(`Invalid ID format: ${id}`);
    }
  }

  /**
   * Retrieves a paginated list of traces for a project by aggregating logs
   * that share the same traceId.
   *
   * @param projectId - The project to query traces for.
   * @param filters - Filtering, pagination, and sorting options.
   * @returns An object containing traces array and pagination metadata.
   */
  static async getTraces(projectId: string, filters: TraceListFilters) {
    try {
      this.validateObjectId(projectId);

      const { startDate, endDate, minDuration, status, service, page, limit, sortBy, sortOrder } = filters;
      const skip = (page - 1) * limit;

      // Build the $match stage
      const matchStage: any = {
        projectId,
        traceId: { $exists: true, $ne: null },
      };

      if (startDate || endDate) {
        matchStage.timestamp = {};
        if (startDate) matchStage.timestamp.$gte = startDate.toISOString();
        if (endDate) matchStage.timestamp.$lte = endDate.toISOString();
      }

      if (service) {
        matchStage.service = service;
      }

      // Build the aggregation pipeline
      const pipeline: any[] = [
        { $match: matchStage },
        {
          $group: {
            _id: "$traceId",
            startTime: { $min: "$timestamp" },
            endTime: { $max: "$timestamp" },
            spanCount: { $sum: 1 },
            rootSpanName: { $first: "$message" },
            hasErrors: {
              $max: {
                $cond: [{ $in: ["$level", ["error", "fatal"]] }, 1, 0],
              },
            },
            services: { $addToSet: "$service" },
          },
        },
        {
          $addFields: {
            traceId: "$_id",
            duration: {
              $subtract: [
                { $toDate: "$endTime" },
                { $toDate: "$startTime" },
              ],
            },
          },
        },
      ];

      // Apply post-aggregation filters
      const postMatchStage: any = {};

      if (minDuration !== undefined) {
        postMatchStage.duration = { $gte: minDuration };
      }

      if (status === "error") {
        postMatchStage.hasErrors = 1;
      } else if (status === "ok") {
        postMatchStage.hasErrors = 0;
      }

      if (Object.keys(postMatchStage).length > 0) {
        pipeline.push({ $match: postMatchStage });
      }

      // Build sort stage
      const sortField =
        sortBy === "startTime" ? "startTime" :
        sortBy === "duration" ? "duration" :
        "spanCount";
      const sortDirection = sortOrder === "asc" ? 1 : -1;
      pipeline.push({ $sort: { [sortField]: sortDirection } });

      // Count total before pagination using a facet
      const countPipeline = [...pipeline, { $count: "total" }];

      // Add pagination
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limit });

      // Project clean output
      pipeline.push({
        $project: {
          _id: 0,
          traceId: 1,
          startTime: 1,
          endTime: 1,
          duration: 1,
          spanCount: 1,
          rootSpanName: 1,
          hasErrors: 1,
          services: 1,
        },
      });

      const [traces, countResult] = await Promise.all([
        LogModel.aggregate(pipeline),
        LogModel.aggregate(countPipeline),
      ]);

      const total = countResult.length > 0 ? countResult[0].total : 0;

      return {
        traces,
        total,
        page,
        limit,
      };
    } catch (error) {
      if (error instanceof TraceValidationError) {
        throw error;
      }
      throw new TraceServiceError(
        `Failed to fetch traces: ${(error as Error).message}`,
        { projectId, filters, originalError: error }
      );
    }
  }

  /**
   * Retrieves all log entries belonging to a specific trace, ordered by timestamp.
   *
   * @param projectId - The project the trace belongs to.
   * @param traceId - The trace identifier.
   * @returns An array of log entries for the trace.
   */
  static async getTraceDetail(projectId: string, traceId: string) {
    try {
      this.validateObjectId(projectId);

      const logs = await LogModel.find({ projectId, traceId })
        .select("-__v")
        .sort({ timestamp: 1 })
        .lean();

      return logs;
    } catch (error) {
      if (error instanceof TraceValidationError) {
        throw error;
      }
      throw new TraceServiceError(
        `Failed to fetch trace detail: ${(error as Error).message}`,
        { projectId, traceId, originalError: error }
      );
    }
  }

  /**
   * Builds a span tree from logs that have spanId within a given trace.
   * Groups logs by spanId and determines parent-child relationships
   * using the data.parentSpanId field.
   *
   * @param projectId - The project the trace belongs to.
   * @param traceId - The trace identifier.
   * @returns An array of span objects with hierarchy information.
   */
  static async getTraceSpans(projectId: string, traceId: string) {
    try {
      this.validateObjectId(projectId);

      const spans = await LogModel.aggregate([
        {
          $match: {
            projectId,
            traceId,
            spanId: { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: "$spanId",
            traceId: { $first: "$traceId" },
            parentSpanId: { $first: "$data.parentSpanId" },
            name: { $first: "$message" },
            startTime: { $min: "$timestamp" },
            endTime: { $max: "$timestamp" },
            level: { $last: "$level" },
            service: { $first: "$service" },
            logCount: { $sum: 1 },
            hasErrors: {
              $max: {
                $cond: [{ $in: ["$level", ["error", "fatal"]] }, 1, 0],
              },
            },
          },
        },
        {
          $addFields: {
            spanId: "$_id",
            duration: {
              $subtract: [
                { $toDate: "$endTime" },
                { $toDate: "$startTime" },
              ],
            },
          },
        },
        {
          $project: {
            _id: 0,
            spanId: 1,
            traceId: 1,
            parentSpanId: 1,
            name: 1,
            startTime: 1,
            endTime: 1,
            duration: 1,
            level: 1,
            service: 1,
            logCount: 1,
            hasErrors: 1,
          },
        },
        { $sort: { startTime: 1 } },
      ]);

      return spans;
    } catch (error) {
      if (error instanceof TraceValidationError) {
        throw error;
      }
      throw new TraceServiceError(
        `Failed to fetch trace spans: ${(error as Error).message}`,
        { projectId, traceId, originalError: error }
      );
    }
  }
}
