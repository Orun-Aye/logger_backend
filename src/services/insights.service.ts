/**
 * @file src/services/dashboardInsightsService.ts
 * @description Provides business logic for generating dashboard insights from log data,
 * with integrated Redis caching.
 */

import mongoose, { Types } from "mongoose";
import { createClient, RedisClientType } from "redis";
import {
  DashboardInsights,
  DateRange,
  InsightsOptions,
  SeverityBreakdown,
  SummaryData,
  ErrorAnalysis,
  FrequentErrorMessage,
  RecentActivity,
  RecentCriticalError,
  EndpointData,
  TimeSeriesDataPoint,
} from "../types/app";
import { LogModel } from "../models/log.model";
import { IProject, ProjectModel } from "../models/project.model";
import { GetInsightsDTO } from "../dtos/dashboard.dto";
import { LogLevel } from "../dtos/log.dto";


let redisClient: RedisClientType | undefined;

interface MatchStage {
  projectId: Types.ObjectId;
  timestamp: { $gte: Date; $lte: Date };
  severity?: string;
  endpoint?: { $exists: boolean; $ne: null };
}

interface GroupStage {
  _id: any;
  [key: string]: any;
}

export class ProjectNotFoundError extends Error {
  constructor(projectId: string) {
    super(`Project with ID ${projectId} not found`);
    this.name = "ProjectNotFoundError";
  }
}

export class DashboardInsightsServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DashboardInsightsServiceError";
  }
}

export class DashboardInsightsService {
  private static readonly cacheExpiry: number = 300;
  private static readonly defaultTimezone: string = "UTC";

  public static async initializeRedis(redisUrl: string): Promise<void> {
    if (redisClient) {
      console.warn("Redis client already initialized.");
      return;
    }
    try {
      redisClient = createClient({ url: redisUrl });
      redisClient.on("error", (err) =>
        console.error("Redis Client Error:", err)
      );
      await redisClient.connect();
      console.log("Redis client connected successfully!");
    } catch (error) {
      console.error("Failed to connect to Redis:", error);
      redisClient = undefined;
      throw new DashboardInsightsServiceError(`Redis connection failed: ${(error as Error).message}`);
    }
  }

  public static async disconnectRedis(): Promise<void> {
    if (redisClient && redisClient.isReady) {
      await redisClient.quit();
      console.log("Redis client disconnected.");
      redisClient = undefined;
    }
  }

  public static async getProjectInsights(
    projectId: string,
    options: GetInsightsDTO = {}
  ): Promise<DashboardInsights> {
    const internalOptions: InsightsOptions = {
      range: options.range,
      from: options.from,
      to: options.to,
      severity: options.severity,
      timezone: options.timezone,
    };

    const {
      range = "7d",
      from,
      to,
      severity,
      timezone = DashboardInsightsService.defaultTimezone,
    } = internalOptions;

    const cacheKey = DashboardInsightsService.generateCacheKey(projectId, internalOptions);
    const startTime = process.hrtime.bigint();

    try {
      if (redisClient && redisClient.isReady) {
        const cachedResult = await DashboardInsightsService.getCachedInsights(cacheKey);
        if (cachedResult) {
          const endTime = process.hrtime.bigint();
          const queryExecutionTime = Number(endTime - startTime) / 1_000_000;
          console.log(`Cache HIT for key: ${cacheKey}`);
          return {
            ...cachedResult,
            meta: {
              ...cachedResult.meta,
              cached: true,
              queryExecutionTime: queryExecutionTime,
              cacheExpiresAt: new Date(Date.now() + DashboardInsightsService.cacheExpiry * 1000).toISOString()
            }
          };
        }
        console.log(`Cache MISS for key: ${cacheKey}`);
      } else {
        console.warn("Redis client not available or not ready, skipping cache lookup.");
      }

      await DashboardInsightsService.validateProjectAccess(projectId);

      const dateRange = DashboardInsightsService.calculateDateRange(range, from, to, timezone);

      const [
        summaryData,
        severityData,
        timeSeriesData,
        endpointData,
        errorAnalysisData,
        recentActivityData,
      ] = await Promise.all([
        DashboardInsightsService.getSummaryData(projectId, dateRange, severity),
        DashboardInsightsService.getSeverityBreakdown(projectId, dateRange, severity),
        DashboardInsightsService.getTimeSeriesData(projectId, dateRange, severity, timezone),
        DashboardInsightsService.getTopEndpoints(projectId, dateRange), // This is the function we're fixing
        DashboardInsightsService.getErrorAnalysis(projectId, dateRange),
        DashboardInsightsService.getRecentActivity(projectId),
      ]);

      const insights: DashboardInsights = {
        projectId,
        timeRange: {
          from: dateRange.from,
          to: dateRange.to,
          range: range,
        },
        summary: summaryData,
        logCountBySeverity: severityData,
        timeSeriesData,
        topEndpoints: endpointData,
        errorAnalysis: errorAnalysisData,
        recentActivity: recentActivityData,
      };

      const endTime = process.hrtime.bigint();
      const queryExecutionTime = Number(endTime - startTime) / 1_000_000;

      if (redisClient && redisClient.isReady) {
        await DashboardInsightsService.cacheInsights(cacheKey, {
          ...insights,
          meta: {
            generatedAt: new Date().toISOString(),
            queryExecutionTime: queryExecutionTime,
            cached: false,
            cacheExpiresAt: new Date(Date.now() + DashboardInsightsService.cacheExpiry * 1000).toISOString()
          }
        });
      }

      return {
        ...insights,
        meta: {
          generatedAt: new Date().toISOString(),
          queryExecutionTime: queryExecutionTime,
          cached: false,
          cacheExpiresAt: (redisClient && redisClient.isReady) ? new Date(Date.now() + DashboardInsightsService.cacheExpiry * 1000).toISOString() : undefined
        }
      };
    } catch (error: any) {
      if (error instanceof ProjectNotFoundError || error instanceof DashboardInsightsServiceError) {
        throw error;
      }
      throw new DashboardInsightsServiceError(`Failed to get dashboard insights: ${error.message || error}`);
    }
  }

  private static async getSummaryData(
    projectId: string,
    dateRange: DateRange,
    severityFilter?: LogLevel
  ): Promise<SummaryData> {
    const matchStage: MatchStage = {
      projectId: new mongoose.Types.ObjectId(projectId),
      timestamp: { $gte: dateRange.from, $lte: dateRange.to },
    };

    if (severityFilter) {
      matchStage.severity = severityFilter;
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalLogs: { $sum: 1 },
          uniqueEndpoints: { $addToSet: "$endpoint" },
          errorCount: {
            $sum: {
              $cond: [{ $in: ["$level", [LogLevel.ERROR, LogLevel.FATAL]] }, 1, 0],
            },
          },
        } as GroupStage,
      },
      {
        $project: {
          totalLogs: 1,
          totalUniqueEndpoints: { $size: "$uniqueEndpoints" },
          errorCount: 1,
          errorRate: {
            $multiply: [{ $divide: ["$errorCount", "$totalLogs"] }, 100],
          },
        },
      },
    ];

    const result = await LogModel.aggregate(pipeline);
    const data = result[0] || {
      totalLogs: 0,
      totalUniqueEndpoints: 0,
      errorCount: 0,
      errorRate: 0,
    };

    const daysDiff = Math.ceil(
      (dateRange.to.getTime() - dateRange.from.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    const averageLogsPerDay =
      daysDiff > 0 ? Math.round(data.totalLogs / daysDiff) : 0;

    return {
      totalLogs: data.totalLogs,
      totalUniqueEndpoints: data.totalUniqueEndpoints,
      averageLogsPerDay,
      errorRate: Math.round(data.errorRate * 10) / 10,
    };
  }

  private static async getSeverityBreakdown(
    projectId: string,
    dateRange: DateRange,
    severityFilter?: LogLevel
  ): Promise<SeverityBreakdown> {
    const matchStage: MatchStage = {
      projectId: new mongoose.Types.ObjectId(projectId),
      timestamp: { $gte: dateRange.from, $lte: dateRange.to },
    };

    if (severityFilter) {
      matchStage.severity = severityFilter;
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: "$level",
          count: { $sum: 1 },
        } as GroupStage,
      },
    ];

    const results = await LogModel.aggregate(pipeline);

    const severityBreakdown: SeverityBreakdown = {
      info: 0, warn: 0, error: 0, critical: 0,
      trace: 0, debug: 0, fatal: 0
    };

    results.forEach((item: { _id: LogLevel; count: number }) => {
      if (Object.values(LogLevel).includes(item._id)) {
        (severityBreakdown as any)[item._id] = item.count;
      }
    });

    return severityBreakdown;
  }

  private static async getTimeSeriesData(
    projectId: string,
    dateRange: DateRange,
    severityFilter?: LogLevel,
    timezone: string = "UTC"
  ): Promise<TimeSeriesDataPoint[]> {
    const matchStage: MatchStage = {
      projectId: new mongoose.Types.ObjectId(projectId),
      timestamp: { $gte: dateRange.from, $lte: dateRange.to },
    };

    if (severityFilter) {
      matchStage.severity = severityFilter;
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$timestamp",
                timezone: timezone,
              },
            },
            severity: "$level",
          },
          count: { $sum: 1 },
        } as GroupStage,
      },
      {
        $group: {
          _id: "$_id.date",
          totalCount: { $sum: "$count" },
          severityBreakdown: {
            $push: {
              severity: "$_id.severity",
              count: "$count",
            },
          },
        } as GroupStage,
      },
      { $sort: { _id: 1 as 1 } },
    ];

    const results = await LogModel.aggregate(pipeline);

    return results.map((item: any): TimeSeriesDataPoint => {
      const severityBreakdown: SeverityBreakdown = {
        info: 0, warn: 0, error: 0, critical: 0,
        trace: 0, debug: 0, fatal: 0
      };

      item.severityBreakdown.forEach(
        (sev: { severity: LogLevel; count: number }) => {
          if (Object.values(LogLevel).includes(sev.severity)) {
            (severityBreakdown as any)[sev.severity] = sev.count;
          }
        }
      );

      return {
        date: item._id,
        timestamp: new Date(`${item._id}T00:00:00Z`).toISOString(),
        totalCount: item.totalCount,
        severityBreakdown,
      };
    });
  }

  /**
   * Get top endpoints data
   */
  private static async getTopEndpoints(
    projectId: string,
    dateRange: DateRange,
    limit: number = 10
  ): Promise<EndpointData[]> {
    const pipeline = [
      {
        $match: {
          projectId: new mongoose.Types.ObjectId(projectId),
          timestamp: { $gte: dateRange.from, $lte: dateRange.to },
          endpoint: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: {
            endpoint: "$endpoint",
            method: "$method",
          },
          totalCount: { $sum: 1 },
          errorCount: {
            $sum: {
              $cond: [
                { $in: ["$level", [LogLevel.ERROR, LogLevel.FATAL]] },
                1,
                0,
              ],
            },
          },
          responseTimes: {
            $push: {
              $cond: [
                {
                  $and: [
                    // Corrected: Check if $responseTime is not null
                    { $ne: ["$responseTime", null] },
                    // Corrected: Check BSON type for numbers (int, long, double, decimal)
                    { $in: [ { $type: "$responseTime" }, ["int", "long", "double", "decimal"] ] },
                  ],
                },
                "$responseTime",
                null,
              ],
            },
          },
        } as GroupStage,
      },
      {
        $project: {
          path: "$_id.endpoint",
          method: { $ifNull: ["$_id.method", "GET"] },
          totalCount: 1,
          errorCount: 1,
          errorRate: {
            $multiply: [{ $divide: ["$errorCount", "$totalCount"] }, 100],
          },
          avgResponseTime: {
            $avg: {
              $filter: {
                input: "$responseTimes",
                cond: { $ne: ["$$this", null] },
              },
            },
          },
        },
      },
      { $sort: { totalCount: -1 as -1 } },
      { $limit: limit },
    ];

    const results = await LogModel.aggregate(pipeline);

    return results.map(
      (item: any): EndpointData => ({
        path: item.path,
        method: item.method,
        totalCount: item.totalCount,
        errorCount: item.errorCount,
        errorRate: Math.round(item.errorRate * 10) / 10,
        avgResponseTime: item.avgResponseTime
          ? Math.round(item.avgResponseTime)
          : null,
      })
    );
  }

  private static async getErrorAnalysis(
    projectId: string,
    dateRange: DateRange
  ): Promise<ErrorAnalysis> {
    const errorMessagesPipeline = [
      {
        $match: {
          projectId: new mongoose.Types.ObjectId(projectId),
          timestamp: { $gte: dateRange.from, $lte: dateRange.to },
          level: { $in: [LogLevel.ERROR, LogLevel.FATAL] },
          message: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: "$message",
          count: { $sum: 1 },
          firstSeen: { $min: "$timestamp" },
          lastSeen: { $max: "$timestamp" },
          affectedEndpoints: { $addToSet: "$endpoint" },
        } as GroupStage,
      },
      { $sort: { count: -1 as -1 } },
      { $limit: 10 },
    ];

    const periodLength = dateRange.to.getTime() - dateRange.from.getTime();
    const previousPeriodStart = new Date(
      dateRange.from.getTime() - periodLength
    );
    const previousPeriodEnd = dateRange.from;

    const [frequentErrors, currentPeriodErrors, previousPeriodErrors] =
      await Promise.all([
        LogModel.aggregate(errorMessagesPipeline),
        LogModel.countDocuments({
          projectId: new mongoose.Types.ObjectId(projectId),
          timestamp: { $gte: dateRange.from, $lte: dateRange.to },
          level: { $in: [LogLevel.ERROR, LogLevel.FATAL] },
        }),
        LogModel.countDocuments({
          projectId: new mongoose.Types.ObjectId(projectId),
          timestamp: { $gte: previousPeriodStart, $lte: previousPeriodEnd },
          level: { $in: [LogLevel.ERROR, LogLevel.FATAL] },
        }),
      ]);

    const percentageChange =
      previousPeriodErrors > 0
        ? ((currentPeriodErrors - previousPeriodErrors) /
            previousPeriodErrors) *
          100
        : 0;

    return {
      frequentErrorMessages: frequentErrors.map(
        (error: any): FrequentErrorMessage => ({
          message: error._id,
          count: error.count,
          firstSeen: error.firstSeen.toISOString(),
          lastSeen: error.lastSeen.toISOString(),
          affectedEndpoints: error.affectedEndpoints.filter(
            (ep: string | null) => ep != null
          ),
        })
      ),
      errorTrends: {
        currentPeriod: currentPeriodErrors,
        previousPeriod: previousPeriodErrors,
        percentageChange: Math.round(percentageChange * 10) / 10,
      },
    };
  }

  private static async getRecentActivity(projectId: string): Promise<RecentActivity> {
    const [latestLog, recentCriticalErrors] = await Promise.all([
      LogModel.findOne({
        projectId: new mongoose.Types.ObjectId(projectId),
      })
        .sort({ timestamp: -1 })
        .lean(),

      LogModel.aggregate([
        {
          $match: {
            projectId: new mongoose.Types.ObjectId(projectId),
            level: LogLevel.FATAL,
            timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: {
              message: "$message",
              endpoint: "$endpoint",
            },
            count: { $sum: 1 },
            latestTimestamp: { $max: "$timestamp" },
          } as GroupStage,
        },
        { $sort: { latestTimestamp: -1 } },
        { $limit: 5 },
      ]),
    ]);

    return {
      latestLog: latestLog
        ? {
            timestamp: latestLog.timestamp.toString(),
            message: latestLog.message,
            level: latestLog.level,
            context: latestLog.data?.context,
          }
        : null,
      recentCriticalErrors: recentCriticalErrors.map(
        (error: any): RecentCriticalError => ({
          timestamp: error.latestTimestamp.toISOString(),
          message: error._id.message,
          endpoint: error._id.endpoint,
          count: error.count,
        })
      ),
    };
  }

  private static async validateProjectAccess(projectId: string): Promise<IProject> {
    if (!Types.ObjectId.isValid(projectId)) {
      throw new DashboardInsightsServiceError("Invalid project ID format.");
    }
    const project = await ProjectModel.findById(projectId);
    if (!project) {
      throw new ProjectNotFoundError(projectId);
    }
    return project;
  }

  private static calculateDateRange(
    range: InsightsOptions['range'],
    from?: string,
    to?: string,
    timezone?: string
  ): DateRange {
    const now = new Date();
    let startDate: Date, endDate: Date;

    if (range === "custom") {
      if (!from || !to) {
        throw new DashboardInsightsServiceError("Custom range requires 'from' and 'to' parameters.");
      }
      startDate = new Date(from);
      endDate = new Date(to);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new DashboardInsightsServiceError("Invalid date format for 'from' or 'to' parameters.");
      }
    } else {
      const durationMap: Record<string, number> = {
        "1h": 1 * 60 * 60 * 1000,
        "24h": 24 * 60 * 60 * 1000,
        "1d": 1 * 24 * 60 * 60 * 1000,
        "7d": 7 * 24 * 60 * 60 * 1000,
        "1w": 7 * 24 * 60 * 60 * 1000,
        "30d": 30 * 24 * 60 * 60 * 1000,
        "4w": 28 * 24 * 60 * 60 * 1000,
        "1m": 30 * 24 * 60 * 60 * 1000,
        "3m": 90 * 24 * 60 * 60 * 1000,
        "6m": 180 * 24 * 60 * 60 * 1000,
        "1y": 365 * 24 * 60 * 60 * 1000,
      };

      const durationMs = durationMap[range || '7d'];
      if (durationMs === undefined) {
        throw new DashboardInsightsServiceError(`Invalid range parameter: ${range}`);
      }

      endDate = new Date(now);
      startDate = new Date(now.getTime() - durationMs);
    }

    return { from: startDate, to: endDate };
  }

  private static generateCacheKey(
    projectId: string,
    options: InsightsOptions
  ): string {
    const sortedOptions = Object.keys(options)
      .sort()
      .reduce((obj: Record<string, any>, key) => {
        const value = options[key as keyof InsightsOptions];
        if (value !== undefined) {
            obj[key] = value;
        }
        return obj;
      }, {});

    const keyParts = [
      "dashboard_insights",
      projectId,
      JSON.stringify(sortedOptions),
    ];
    return keyParts.join(":");
  }

  private static async getCachedInsights(
    cacheKey: string
  ): Promise<DashboardInsights | null> {
    try {
      if (!redisClient || !redisClient.isReady) {
        console.warn("Redis client not ready for cache retrieval.");
        return null;
      }
      const cached = await redisClient.get(cacheKey);
      if (cached && typeof cached === "string") {
        const data: DashboardInsights = JSON.parse(cached);
        if (data.timeRange) {
          data.timeRange.from = new Date(data.timeRange.from);
          data.timeRange.to = new Date(data.timeRange.to);
        }
        return data;
      }
    } catch (error) {
      console.warn("Cache retrieval failed:", (error as Error).message);
    }
    return null;
  }

  private static async cacheInsights(
    cacheKey: string,
    insights: DashboardInsights
  ): Promise<void> {
    try {
      if (!redisClient || !redisClient.isReady) {
        console.warn("Redis client not ready for cache storage.");
        return;
      }
      const insightsToStore = {
        ...insights,
        timeRange: {
          ...insights.timeRange,
          from: insights.timeRange.from.toISOString(),
          to: insights.timeRange.to.toISOString(),
        },
        recentActivity: insights.recentActivity ? {
          ...insights.recentActivity,
          latestLog: insights.recentActivity.latestLog ? {
            ...insights.recentActivity.latestLog,
            timestamp: insights.recentActivity.latestLog.timestamp,
          } : null,
          recentCriticalErrors: insights.recentActivity.recentCriticalErrors.map(err => ({
            ...err,
            timestamp: err.timestamp,
          }))
        } : insights.recentActivity,
        errorAnalysis: insights.errorAnalysis ? {
          ...insights.errorAnalysis,
          frequentErrorMessages: insights.errorAnalysis.frequentErrorMessages.map(msg => ({
            ...msg,
            firstSeen: msg.firstSeen,
            lastSeen: msg.lastSeen,
          }))
        } : insights.errorAnalysis
      };

      await redisClient.setEx(
        cacheKey,
        DashboardInsightsService.cacheExpiry,
        JSON.stringify(insightsToStore)
      );
    } catch (error) {
      console.warn("Cache storage failed:", (error as Error).message);
    }
  }

  public static async invalidateProjectCache(projectId: string): Promise<void> {
    try {
      if (!redisClient || !redisClient.isReady) {
        console.warn("Redis client not ready for cache invalidation.");
        return;
      }
      const pattern = `dashboard_insights:${projectId}:*`;
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
        console.log(`Invalidated ${keys.length} cache entries for project ${projectId}.`);
      } else {
        console.log(`No cache entries found to invalidate for project ${projectId}.`);
      }
    } catch (error) {
      console.warn("Cache invalidation failed:", (error as Error).message);
    }
  }
}