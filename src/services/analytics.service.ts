// src/services/analytics.service.ts
import { LogModel } from "../models/log.model";
import { LogLevel } from "../dtos/log.dto";

/**
 * Session ID resolution.
 *
 * The SDK sends `sessionId` as a top-level field, which is what the model
 * indexes and what ErrorGroup counts users by. Logs ingested before the SDK
 * started sending it carried the value at `context.sessionId` instead. Every
 * session query prefers the top-level field and falls back to the nested one
 * so historical data keeps resolving.
 */
const SESSION_ID_EXPR = { $ifNull: ["$sessionId", "$context.sessionId"] };

/** Matches logs carrying a session ID in either location. */
const HAS_SESSION_ID = {
  $or: [
    { sessionId: { $exists: true, $ne: null } },
    { "context.sessionId": { $exists: true, $ne: null } },
  ],
};

/** Matches one specific session ID in either location. */
const sessionIdMatch = (sessionId: string) => ({
  $or: [{ sessionId }, { "context.sessionId": sessionId }],
});

export class AnalyticsService {
  // ============================================================================
  // ERROR ANALYTICS
  // ============================================================================

  static async getErrorTimeline(
    projectId: string,
    options: { timeRange: string; granularity: "hour" | "day" }
  ) {
    const { startDate, endDate } = this.parseTimeRange(options.timeRange);
    const dateFormat =
      options.granularity === "hour" ? "%Y-%m-%dT%H:00:00Z" : "%Y-%m-%d";

    const timeline = await LogModel.aggregate([
      {
        $match: {
          projectId,
          timestamp: {
            $gte: startDate.toISOString(),
            $lte: endDate.toISOString(),
          },
          level: { $in: ["error", "warn", "fatal"] },
        },
      },
      {
        $group: {
          _id: {
            time: {
              $dateToString: {
                format: dateFormat,
                date: { $toDate: "$timestamp" },
              },
            },
            level: "$level",
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.time",
          errors: {
            $sum: { $cond: [{ $eq: ["$_id.level", "error"] }, "$count", 0] },
          },
          warnings: {
            $sum: { $cond: [{ $eq: ["$_id.level", "warn"] }, "$count", 0] },
          },
          fatal: {
            $sum: { $cond: [{ $eq: ["$_id.level", "fatal"] }, "$count", 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          time: "$_id",
          errors: 1,
          warnings: 1,
          fatal: 1,
          _id: 0,
        },
      },
    ]);

    return timeline;
  }

  static async getTopErrors(
    projectId: string,
    options: { limit: number; timeRange: string }
  ) {
    const { startDate, endDate } = this.parseTimeRange(options.timeRange);

    const topErrors = await LogModel.aggregate([
      {
        $match: {
          projectId,
          timestamp: {
            $gte: startDate.toISOString(),
            $lte: endDate.toISOString(),
          },
          level: { $in: ["error", "fatal"] },
          "error.message": { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: "$error.message",
          count: { $sum: 1 },
          lastSeen: { $max: "$timestamp" },
          affectedUsers: { $addToSet: "$context.userId" },
          service: { $first: "$service" },
          stackTraces: { $addToSet: "$error.stack" },
        },
      },
      {
        $project: {
          message: "$_id",
          count: 1,
          lastSeen: 1,
          affectedUsers: { $size: "$affectedUsers" },
          service: 1,
          hasMultipleStacks: { $gt: [{ $size: "$stackTraces" }, 1] },
          _id: 0,
        },
      },
      { $sort: { count: -1 } },
      { $limit: options.limit },
    ]);

    // Calculate trends (compare with previous period)
    const previousPeriod = this.getPreviousPeriod(startDate, endDate);
    for (const error of topErrors) {
      const previousCount = await LogModel.countDocuments({
        projectId,
        timestamp: {
          $gte: previousPeriod.start.toISOString(),
          $lte: previousPeriod.end.toISOString(),
        },
        "error.message": error.message,
      });

      error.trend =
        previousCount === 0
          ? "up"
          : error.count > previousCount
          ? "up"
          : error.count < previousCount
          ? "down"
          : "stable";
    }

    return topErrors;
  }

  static async getErrorDistribution(
    projectId: string,
    options: { timeRange: string }
  ) {
    const { startDate, endDate } = this.parseTimeRange(options.timeRange);

    const distribution = await LogModel.aggregate([
      {
        $match: {
          projectId,
          timestamp: {
            $gte: startDate.toISOString(),
            $lte: endDate.toISOString(),
          },
          level: { $in: ["error", "fatal", "warn"] },
          "error.name": { $exists: true },
        },
      },
      {
        $group: {
          _id: "$error.name",
          value: { $sum: 1 },
        },
      },
      { $sort: { value: -1 } },
      { $limit: 10 },
      {
        $project: {
          name: "$_id",
          value: 1,
          _id: 0,
        },
      },
    ]);

    // Assign colors
    const colors = [
      "#ef4444",
      "#f97316",
      "#eab308",
      "#84cc16",
      "#22c55e",
      "#10b981",
      "#14b8a6",
      "#06b6d4",
      "#0ea5e9",
      "#6366f1",
    ];
    distribution.forEach((item, idx) => {
      item.color = colors[idx] || "#6b7280";
    });

    return distribution;
  }

  static async getErrorStats(
    projectId: string,
    options: { timeRange: string }
  ) {
    const { startDate, endDate } = this.parseTimeRange(options.timeRange);
    const previousPeriod = this.getPreviousPeriod(startDate, endDate);

    const [currentStats, previousStats] = await Promise.all([
      this.calculateErrorStats(projectId, startDate, endDate),
      this.calculateErrorStats(
        projectId,
        previousPeriod.start,
        previousPeriod.end
      ),
    ]);

    return {
      totalErrors: currentStats.totalErrors,
      errorRate: currentStats.errorRate,
      affectedUsers: currentStats.affectedUsers,
      mttr: currentStats.mttr,
      changes: {
        totalErrors: this.calculateChange(
          currentStats.totalErrors,
          previousStats.totalErrors
        ),
        errorRate: this.calculateChange(
          currentStats.errorRate,
          previousStats.errorRate
        ),
        affectedUsers: this.calculateChange(
          currentStats.affectedUsers,
          previousStats.affectedUsers
        ),
        mttr: this.calculateChange(currentStats.mttr, previousStats.mttr),
      },
    };
  }

  static async getErrorDetails(projectId: string, errorMessage: string) {
    const recentOccurrences = await LogModel.find({
      projectId,
      "error.message": errorMessage,
    })
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

    const stats = await LogModel.aggregate([
      {
        $match: {
          projectId,
          "error.message": errorMessage,
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          firstSeen: { $min: "$timestamp" },
          lastSeen: { $max: "$timestamp" },
          affectedUsers: { $addToSet: "$context.userId" },
          services: { $addToSet: "$service" },
          environments: { $addToSet: "$environment" },
          urls: { $addToSet: "$url" },
        },
      },
    ]);

    return {
      message: errorMessage,
      occurrences: recentOccurrences,
      stats: stats[0] || {},
    };
  }

  static async getErrorTrends(
    projectId: string,
    options: { timeRange: string; groupBy: "hour" | "day" | "week" }
  ) {
    const { startDate, endDate } = this.parseTimeRange(options.timeRange);
    const dateFormat =
      options.groupBy === "hour"
        ? "%Y-%m-%dT%H:00:00Z"
        : options.groupBy === "day"
        ? "%Y-%m-%d"
        : "%Y-W%U";

    const trends = await LogModel.aggregate([
      {
        $match: {
          projectId,
          timestamp: {
            $gte: startDate.toISOString(),
            $lte: endDate.toISOString(),
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: dateFormat,
              date: { $toDate: "$timestamp" },
            },
          },
          total: { $sum: 1 },
          errors: {
            $sum: { $cond: [{ $in: ["$level", ["error", "fatal"]] }, 1, 0] },
          },
          uniqueErrors: { $addToSet: "$error.message" },
        },
      },
      {
        $project: {
          time: "$_id",
          total: 1,
          errors: 1,
          uniqueErrorCount: {
            $size: {
              $filter: {
                input: "$uniqueErrors",
                cond: { $ne: ["$$this", null] },
              },
            },
          },
          errorRate: { $multiply: [{ $divide: ["$errors", "$total"] }, 100] },
          _id: 0,
        },
      },
      { $sort: { time: 1 } },
    ]);

    return trends;
  }

  // ============================================================================
  // PERFORMANCE ANALYTICS
  // ============================================================================

  static async getPerformanceTimeline(
    projectId: string,
    options: { timeRange: string; metric: string }
  ) {
    const { startDate, endDate } = this.parseTimeRange(options.timeRange);

    // Query both performance and network events for a combined timeline
    const timeline = await LogModel.aggregate([
      {
        $match: {
          projectId,
          timestamp: {
            $gte: startDate.toISOString(),
            $lte: endDate.toISOString(),
          },
          eventType: { $in: ["performance", "network"] },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%dT%H:00:00Z",
              date: { $toDate: "$timestamp" },
            },
          },
          lcp: {
            $avg: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$eventType", "performance"] },
                    { $eq: ["$data.performance.type", "navigation"] },
                  ],
                },
                "$data.performance.duration",
                null,
              ],
            },
          },
          fcp: {
            $avg: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$eventType", "performance"] },
                    { $eq: ["$data.performance.type", "paint"] },
                  ],
                },
                "$data.performance.duration",
                null,
              ],
            },
          },
          ttfb: {
            $avg: {
              $cond: [
                { $eq: ["$eventType", "performance"] },
                "$data.performance.startTime",
                null,
              ],
            },
          },
          networkDurations: {
            $push: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$eventType", "network"] },
                    { $gt: ["$data.network.duration", null] },
                  ],
                },
                "$data.network.duration",
                "$$REMOVE",
              ],
            },
          },
        },
      },
      {
        $addFields: {
          sortedNetworkDurations: { $sortArray: { input: "$networkDurations", sortBy: 1 } },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          time: "$_id",
          lcp: { $round: ["$lcp", 0] },
          fcp: { $round: ["$fcp", 0] },
          ttfb: { $round: ["$ttfb", 0] },
          avg: {
            $round: [
              { $avg: "$networkDurations" },
              0,
            ],
          },
          p95: {
            $cond: [
              { $gt: [{ $size: "$sortedNetworkDurations" }, 0] },
              {
                $round: [
                  {
                    $arrayElemAt: [
                      "$sortedNetworkDurations",
                      { $floor: { $multiply: [{ $size: "$sortedNetworkDurations" }, 0.95] } },
                    ],
                  },
                  0,
                ],
              },
              null,
            ],
          },
          _id: 0,
        },
      },
    ]);

    return timeline;
  }

  static async getWebVitals(projectId: string, options: { timeRange: string }) {
    const { startDate, endDate } = this.parseTimeRange(options.timeRange);

    const vitals = await LogModel.aggregate([
      {
        $match: {
          projectId,
          timestamp: {
            $gte: startDate.toISOString(),
            $lte: endDate.toISOString(),
          },
          eventType: "web-vital",
          "data.vital.name": { $exists: true },
          "data.vital.value": { $exists: true, $type: "number" },
        },
      },
      {
        $group: {
          _id: "$data.vital.name",
          values: { $push: "$data.vital.value" },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          sortedValues: { $sortArray: { input: "$values", sortBy: 1 } },
        },
      },
      {
        $project: {
          name: "$_id",
          avg: { $avg: "$sortedValues" },
          p75: {
            $arrayElemAt: [
              "$sortedValues",
              { $floor: { $multiply: [{ $size: "$sortedValues" }, 0.75] } },
            ],
          },
          count: 1,
          _id: 0,
        },
      },
    ]);

    // Transform array into keyed object { lcp: { avg, p75 }, fcp: { avg, p75 }, cls: { avg, p75 }, inp: { avg, p75 } }
    const result: Record<string, { avg: number | null; p75: number | null }> = {
      lcp: { avg: null, p75: null },
      fcp: { avg: null, p75: null },
      cls: { avg: null, p75: null },
      inp: { avg: null, p75: null },
    };

    for (const v of vitals) {
      const key = (v.name || "").toLowerCase();
      if (key in result) {
        result[key] = { avg: v.avg, p75: v.p75 };
      }
    }

    return result;
  }

  static async getResourcePerformance(
    projectId: string,
    options: { timeRange: string; limit: number }
  ) {
    const { startDate, endDate } = this.parseTimeRange(options.timeRange);

    const resources = await LogModel.aggregate([
      {
        $match: {
          projectId,
          timestamp: {
            $gte: startDate.toISOString(),
            $lte: endDate.toISOString(),
          },
          eventType: "network",
          "data.network.url": { $exists: true },
          "data.network.duration": { $exists: true, $type: "number" },
        },
      },
      {
        $group: {
          _id: "$data.network.url",
          calls: { $sum: 1 },
          responseTimes: { $push: "$data.network.duration" },
          errors: {
            $sum: { $cond: [{ $gte: ["$data.network.status", 400] }, 1, 0] },
          },
        },
      },
      {
        $addFields: {
          sortedTimes: { $sortArray: { input: "$responseTimes", sortBy: 1 } },
        },
      },
      {
        $project: {
          name: "$_id",
          calls: 1,
          avgDuration: { $round: [{ $avg: "$responseTimes" }, 0] },
          p95: {
            $arrayElemAt: [
              "$sortedTimes",
              { $floor: { $multiply: [{ $size: "$sortedTimes" }, 0.95] } },
            ],
          },
          p99: {
            $arrayElemAt: [
              "$sortedTimes",
              { $floor: { $multiply: [{ $size: "$sortedTimes" }, 0.99] } },
            ],
          },
          errors: 1,
          _id: 0,
        },
      },
      { $sort: { calls: -1 } },
      { $limit: options.limit },
    ]);

    return resources;
  }

  static async getPagePerformance(
    projectId: string,
    options: { timeRange: string; limit: number }
  ) {
    const { startDate, endDate } = this.parseTimeRange(options.timeRange);

    const pages = await LogModel.aggregate([
      {
        $match: {
          projectId,
          timestamp: {
            $gte: startDate.toISOString(),
            $lte: endDate.toISOString(),
          },
          eventType: { $in: ["pageview", "performance"] },
          url: { $exists: true },
        },
      },
      {
        $group: {
          _id: "$url",
          views: {
            $sum: { $cond: [{ $eq: ["$eventType", "pageview"] }, 1, 0] },
          },
          loadTimes: {
            $push: {
              $cond: [
                { $eq: ["$eventType", "performance"] },
                "$data.performance.duration",
                null,
              ],
            },
          },
          fcp: {
            $avg: {
              $cond: [
                { $eq: ["$data.performance.type", "paint"] },
                "$data.performance.duration",
                null,
              ],
            },
          },
          lcp: {
            $avg: {
              $cond: [
                { $eq: ["$data.performance.type", "navigation"] },
                "$data.performance.duration",
                null,
              ],
            },
          },
        },
      },
      {
        $project: {
          page: "$_id",
          views: 1,
          loadTime: {
            $round: [
              {
                $avg: {
                  $filter: {
                    input: "$loadTimes",
                    cond: { $ne: ["$$this", null] },
                  },
                },
              },
              0,
            ],
          },
          fcp: { $round: ["$fcp", 0] },
          lcp: { $round: ["$lcp", 0] },
          _id: 0,
        },
      },
      { $sort: { views: -1 } },
      { $limit: options.limit },
    ]);

    return pages;
  }

  static async getPerformanceScore(
    projectId: string,
    options: { timeRange: string }
  ) {
    const { startDate, endDate } = this.parseTimeRange(options.timeRange);

    const timeFilter = {
      $gte: startDate.toISOString(),
      $lte: endDate.toISOString(),
    };

    // Query performance entries for load time
    const perfMetrics = await LogModel.aggregate([
      {
        $match: {
          projectId,
          timestamp: timeFilter,
          eventType: "performance",
        },
      },
      {
        $group: {
          _id: null,
          avgLoadTime: { $avg: "$data.performance.duration" },
        },
      },
    ]);

    // Query web-vital events for LCP, FCP, CLS
    const vitalMetrics = await LogModel.aggregate([
      {
        $match: {
          projectId,
          timestamp: timeFilter,
          eventType: "web-vital",
          "data.vital.name": { $exists: true },
          "data.vital.value": { $exists: true, $type: "number" },
        },
      },
      {
        $group: {
          _id: "$data.vital.name",
          avg: { $avg: "$data.vital.value" },
        },
      },
    ]);

    const avgLoadTime = perfMetrics[0]?.avgLoadTime ?? null;

    // Build a map from vital name to average value
    const vitalMap: Record<string, number> = {};
    for (const v of vitalMetrics) {
      if (v._id) vitalMap[v._id.toLowerCase()] = v.avg;
    }

    const avgLCP = vitalMap["lcp"] ?? null;
    const avgFCP = vitalMap["fcp"] ?? null;
    const avgCLS = vitalMap["cls"] ?? null;

    // Query network events for response time stats
    const networkStats = await LogModel.aggregate([
      {
        $match: {
          projectId,
          timestamp: timeFilter,
          eventType: "network",
          "data.network.duration": { $exists: true, $type: "number" },
        },
      },
      {
        $group: {
          _id: null,
          avgResponseTime: { $avg: "$data.network.duration" },
          responseTimes: { $push: "$data.network.duration" },
        },
      },
      {
        $addFields: {
          sortedTimes: { $sortArray: { input: "$responseTimes", sortBy: 1 } },
        },
      },
      {
        $project: {
          avgResponseTime: { $round: ["$avgResponseTime", 0] },
          p95ResponseTime: {
            $round: [
              {
                $arrayElemAt: [
                  "$sortedTimes",
                  { $floor: { $multiply: [{ $size: "$sortedTimes" }, 0.95] } },
                ],
              },
              0,
            ],
          },
          _id: 0,
        },
      },
    ]);

    // Query error rate
    const errorStats = await LogModel.aggregate([
      {
        $match: {
          projectId,
          timestamp: timeFilter,
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          errors: {
            $sum: { $cond: [{ $in: ["$level", ["error", "fatal"]] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          errorRate: {
            $cond: [
              { $gt: ["$total", 0] },
              { $round: [{ $multiply: [{ $divide: ["$errors", "$total"] }, 100] }, 2] },
              0,
            ],
          },
          _id: 0,
        },
      },
    ]);

    const avgResponseTime = networkStats[0]?.avgResponseTime ?? null;
    const p95ResponseTime = networkStats[0]?.p95ResponseTime ?? null;
    const errorRate = errorStats[0]?.errorRate ?? null;

    if (avgLoadTime == null && avgLCP == null && avgFCP == null && avgCLS == null) {
      return { score: 0, grade: "N/A", breakdown: {}, avgResponseTime, p95ResponseTime, errorRate };
    }

    // Calculate score (0-100)
    const scores = {
      loadTime: avgLoadTime != null ? this.calculateMetricScore(avgLoadTime, 1000, 3000) : 50,
      lcp: avgLCP != null ? this.calculateMetricScore(avgLCP, 2500, 4000) : 50,
      fcp: avgFCP != null ? this.calculateMetricScore(avgFCP, 1800, 3000) : 50,
      cls: avgCLS != null ? this.calculateMetricScore(avgCLS, 0.1, 0.25) : 50,
    };

    const totalScore = Math.round(
      scores.loadTime * 0.3 +
        scores.lcp * 0.3 +
        scores.fcp * 0.2 +
        scores.cls * 0.2
    );

    return {
      score: totalScore,
      grade:
        totalScore >= 90
          ? "A"
          : totalScore >= 75
          ? "B"
          : totalScore >= 60
          ? "C"
          : totalScore >= 45
          ? "D"
          : "F",
      breakdown: {
        loadTime: { score: scores.loadTime, value: avgLoadTime != null ? Math.round(avgLoadTime) : null },
        lcp: { score: scores.lcp, value: avgLCP != null ? Math.round(avgLCP) : null },
        fcp: { score: scores.fcp, value: avgFCP != null ? Math.round(avgFCP) : null },
        cls: { score: scores.cls, value: avgCLS != null ? avgCLS.toFixed(3) : null },
      },
      avgResponseTime,
      p95ResponseTime,
      errorRate,
    };
  }

  static async getSlowestEndpoints(
    projectId: string,
    options: { timeRange: string; limit: number }
  ) {
    const { startDate, endDate } = this.parseTimeRange(options.timeRange);

    const endpoints = await LogModel.aggregate([
      {
        $match: {
          projectId,
          timestamp: {
            $gte: startDate.toISOString(),
            $lte: endDate.toISOString(),
          },
          eventType: "network",
          "data.network.duration": { $exists: true, $type: "number" },
        },
      },
      {
        $group: {
          _id: "$data.network.url",
          avgDuration: { $avg: "$data.network.duration" },
          maxDuration: { $max: "$data.network.duration" },
          calls: { $sum: 1 },
          method: { $first: "$data.network.method" },
          responseTimes: { $push: "$data.network.duration" },
        },
      },
      {
        $addFields: {
          sortedTimes: { $sortArray: { input: "$responseTimes", sortBy: 1 } },
        },
      },
      {
        $project: {
          url: "$_id",
          avgDuration: { $round: ["$avgDuration", 0] },
          maxDuration: { $round: ["$maxDuration", 0] },
          p95: {
            $round: [
              {
                $arrayElemAt: [
                  "$sortedTimes",
                  { $floor: { $multiply: [{ $size: "$sortedTimes" }, 0.95] } },
                ],
              },
              0,
            ],
          },
          calls: 1,
          method: 1,
          _id: 0,
        },
      },
      { $sort: { avgDuration: -1 } },
      { $limit: options.limit },
    ]);

    return endpoints;
  }

  // ============================================================================
  // REAL-TIME ACTIVITY FEED
  // ============================================================================

  static async getActivityFeed(projectId: string, filters: any) {
    const query: any = { projectId };

    if (filters.level) query.level = filters.level;
    if (filters.eventType) query.eventType = filters.eventType;
    if (filters.service) query.service = filters.service;
    if (filters.environment) query.environment = filters.environment;
    if (filters.search) {
      query.message = { $regex: filters.search, $options: "i" };
    }

    const skip = (filters.page - 1) * filters.limit;

    const [logs, total] = await Promise.all([
      LogModel.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(filters.limit)
        .lean(),
      LogModel.countDocuments(query),
    ]);

    return {
      logs,
      pagination: {
        current: filters.page,
        total: Math.ceil(total / filters.limit),
        count: logs.length,
        totalRecords: total,
      },
    };
  }

  static async getActivityStats(
    projectId: string,
    options: { timeRange: string }
  ) {
    const { startDate, endDate } = this.parseTimeRange(options.timeRange);

    const matchStage = {
      $match: {
        projectId,
        timestamp: {
          $gte: startDate.toISOString(),
          $lte: endDate.toISOString(),
        },
      },
    };

    const [levelStats, serviceStats] = await Promise.all([
      LogModel.aggregate([
        matchStage,
        {
          $group: {
            _id: "$level",
            count: { $sum: 1 },
          },
        },
      ]),
      LogModel.distinct("service", {
        projectId,
        timestamp: {
          $gte: startDate.toISOString(),
          $lte: endDate.toISOString(),
        },
      }),
    ]);

    const levelCounts = levelStats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {} as Record<string, number>);

    const totalEvents = (Object.values(levelCounts) as number[]).reduce((sum, count) => sum + count, 0);
    const errorCount = (levelCounts["error"] || 0) + (levelCounts["fatal"] || 0);
    const errorRate = totalEvents > 0 ? errorCount / totalEvents : 0;
    const activeServices = serviceStats.filter(Boolean).length;

    return {
      ...levelCounts,
      totalEvents,
      eventsToday: totalEvents,
      activeServices,
      services: activeServices,
      errorRate,
      errorCount,
    };
  }

  static async getFilterValues(projectId: string) {
    const [levels, eventTypes, services, environments] = await Promise.all([
      LogModel.distinct("level", { projectId }),
      LogModel.distinct("eventType", { projectId }),
      LogModel.distinct("service", { projectId }),
      LogModel.distinct("environment", { projectId }),
    ]);

    return {
      levels: levels.filter(Boolean),
      eventTypes: eventTypes.filter(Boolean),
      services: services.filter(Boolean),
      environments: environments.filter(Boolean),
    };
  }

  static async streamActivity(projectId: string, options: { since: Date }) {
    const logs = await LogModel.find({
      projectId,
      timestamp: { $gte: options.since.toISOString() },
    })
      .sort({ timestamp: -1 })
      .limit(50)
      .lean();

    return logs;
  }

  // ============================================================================
  // SESSION ANALYTICS
  // ============================================================================

  static async getSessions(projectId: string, options: any) {
    const { startDate, endDate } = this.parseTimeRange(options.timeRange);

    const sessions = await LogModel.aggregate([
      {
        $match: {
          projectId,
          timestamp: {
            $gte: startDate.toISOString(),
            $lte: endDate.toISOString(),
          },
          ...HAS_SESSION_ID,
        },
      },
      {
        $group: {
          _id: SESSION_ID_EXPR,
          userId: { $first: "$context.userId" },
          startTime: { $min: "$timestamp" },
          endTime: { $max: "$timestamp" },
          pageViews: {
            $sum: { $cond: [{ $eq: ["$eventType", "pageview"] }, 1, 0] },
          },
          events: { $sum: 1 },
          hasErrors: {
            $max: { $cond: [{ $in: ["$level", ["error", "fatal"]] }, 1, 0] },
          },
          device: { $first: "$context.device" },
          browser: { $first: "$context.browser" },
          country: { $first: "$context.country" },
          entryPage: { $first: "$url" },
          exitPage: { $last: "$url" },
        },
      },
      {
        $addFields: {
          duration: {
            $divide: [
              {
                $subtract: [{ $toDate: "$endTime" }, { $toDate: "$startTime" }],
              },
              1000,
            ],
          },
        },
      },
      { $sort: { startTime: -1 } },
      { $skip: (options.page - 1) * options.limit },
      { $limit: options.limit },
    ]);

    const totalAgg = await LogModel.aggregate([
      {
        $match: {
          projectId,
          timestamp: {
            $gte: startDate.toISOString(),
            $lte: endDate.toISOString(),
          },
          ...HAS_SESSION_ID,
        },
      },
      { $group: { _id: SESSION_ID_EXPR } },
      { $count: "total" },
    ]);
    const total = totalAgg[0]?.total ?? 0;

    return {
      sessions,
      pagination: {
        current: options.page,
        total: Math.ceil(total / options.limit),
        count: sessions.length,
        totalRecords: total,
      },
    };
  }

  static async getSessionDetails(projectId: string, sessionId: string) {
    const logs = await LogModel.find({
      projectId,
      ...sessionIdMatch(sessionId),
    })
      .sort({ timestamp: 1 })
      .lean();

    if (logs.length === 0) {
      return null;
    }

    const startTime = new Date(logs[0].timestamp);
    const endTime = new Date(logs[logs.length - 1].timestamp);
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;

    return {
      sessionId,
      userId: logs[0].context?.userId,
      startTime,
      endTime,
      duration,
      pageViews: logs.filter((l) => l.eventType === "pageview").length,
      events: logs.length,
      hasErrors: logs.some((l) => ["error", "fatal"].includes(l.level)),
      device: logs[0].context?.device,
      browser: logs[0].context?.browser,
      country: logs[0].context?.country,
      entryPage: logs[0].url,
      exitPage: logs[logs.length - 1].url,
    };
  }

  static async getSessionTimeline(projectId: string, sessionId: string) {
    const timeline = await LogModel.find({
      projectId,
      ...sessionIdMatch(sessionId),
    })
      .sort({ timestamp: 1 })
      .select("timestamp eventType level message url data error")
      .lean();

    return timeline.map((event) => ({
      type: event.eventType || "unknown",
      timestamp: new Date(event.timestamp),
      level: event.level,
      message: event.message,
      url: event.url,
      data: event.data,
      error: event.error,
    }));
  }

  static async getSessionStats(
    projectId: string,
    options: { timeRange: string }
  ) {
    const { startDate, endDate } = this.parseTimeRange(options.timeRange);

    const stats = await LogModel.aggregate([
      {
        $match: {
          projectId,
          timestamp: {
            $gte: startDate.toISOString(),
            $lte: endDate.toISOString(),
          },
          ...HAS_SESSION_ID,
        },
      },
      {
        $group: {
          _id: SESSION_ID_EXPR,
          startTime: { $min: { $toDate: "$timestamp" } },
          endTime: { $max: { $toDate: "$timestamp" } },
          pageViews: {
            $sum: { $cond: [{ $eq: ["$eventType", "pageview"] }, 1, 0] },
          },
          hasErrors: {
            $max: { $cond: [{ $in: ["$level", ["error", "fatal"]] }, 1, 0] },
          },
        },
      },
      {
        $addFields: {
          duration: {
            $divide: [{ $subtract: ["$endTime", "$startTime"] }, 1000],
          },
        },
      },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          avgDuration: { $avg: "$duration" },
          avgPageViews: { $avg: "$pageViews" },
          sessionsWithErrors: { $sum: "$hasErrors" },
        },
      },
    ]);

    return stats[0] || {};
  }

  static async getUserJourneys(projectId: string, options: any) {
    const { startDate, endDate } = this.parseTimeRange(options.timeRange);

    const journeys = await LogModel.aggregate([
      {
        $match: {
          projectId,
          timestamp: {
            $gte: startDate.toISOString(),
            $lte: endDate.toISOString(),
          },
          eventType: "pageview",
          ...HAS_SESSION_ID,
        },
      },
      {
        $group: {
          _id: SESSION_ID_EXPR,
          pages: { $push: { url: "$url", timestamp: "$timestamp" } },
        },
      },
      {
        $project: {
          journey: {
            $reduce: {
              input: "$pages",
              initialValue: [],
              in: { $concatArrays: ["$$value", ["$$this.url"]] },
            },
          },
        },
      },
      {
        $group: {
          _id: "$journey",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: options.limit },
    ]);

    return journeys;
  }

  // ============================================================================
  // ENVIRONMENT ANALYTICS
  // ============================================================================

  /**
   * Get per-environment statistics for a project
   */
  static async getEnvironmentStats(projectId: string, options: { timeRange: string }) {
    const { startDate, endDate } = this.parseTimeRange(options.timeRange);

    const pipeline = [
      {
        $match: {
          projectId: projectId,
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: "$environment",
          totalLogs: { $sum: 1 },
          errorCount: {
            $sum: { $cond: [{ $in: ["$level", ["error", "fatal"]] }, 1, 0] },
          },
          warnCount: {
            $sum: { $cond: [{ $eq: ["$level", "warn"] }, 1, 0] },
          },
          avgResponseTime: {
            $avg: {
              $cond: [{ $and: [{ $ne: ["$data.network.duration", null] }, { $isNumber: "$data.network.duration" }] }, "$data.network.duration", null],
            },
          },
          lastActivity: { $max: "$createdAt" },
        },
      },
      {
        $project: {
          _id: 0,
          environment: { $ifNull: ["$_id", "unknown"] },
          totalLogs: 1,
          errorCount: 1,
          warnCount: 1,
          errorRate: {
            $cond: [
              { $gt: ["$totalLogs", 0] },
              { $multiply: [{ $divide: ["$errorCount", "$totalLogs"] }, 100] },
              0,
            ],
          },
          avgResponseTime: { $round: [{ $ifNull: ["$avgResponseTime", 0] }, 2] },
          lastActivity: 1,
        },
      },
      { $sort: { totalLogs: -1 as const } },
    ];

    const results = await LogModel.aggregate(pipeline);
    return results;
  }

  // ============================================================================
  // NETWORK ANALYTICS
  // ============================================================================

  static async getNetworkOverview(
    projectId: string,
    options: { timeRange: string }
  ) {
    const { startDate, endDate } = this.parseTimeRange(options.timeRange);
    const previousPeriod = this.getPreviousPeriod(startDate, endDate);
    const timeFilter = {
      $gte: startDate.toISOString(),
      $lte: endDate.toISOString(),
    };
    const prevTimeFilter = {
      $gte: previousPeriod.start.toISOString(),
      $lte: previousPeriod.end.toISOString(),
    };

    const baseMatch = { projectId, eventType: "network" };

    const [currentStats, previousStats, statusDistribution] = await Promise.all([
      LogModel.aggregate([
        {
          $match: { ...baseMatch, timestamp: timeFilter },
        },
        {
          $group: {
            _id: null,
            totalRequests: { $sum: 1 },
            failedRequests: {
              $sum: { $cond: [{ $gte: ["$data.network.status", 400] }, 1, 0] },
            },
            durations: { $push: "$data.network.duration" },
          },
        },
        {
          $addFields: {
            validDurations: {
              $filter: {
                input: "$durations",
                cond: { $and: [{ $ne: ["$$this", null] }, { $isNumber: "$$this" }] },
              },
            },
          },
        },
        {
          $addFields: {
            sortedDurations: { $sortArray: { input: "$validDurations", sortBy: 1 } },
          },
        },
        {
          $project: {
            _id: 0,
            totalRequests: 1,
            failedRequests: 1,
            avgDuration: { $round: [{ $avg: "$validDurations" }, 0] },
            p95Duration: {
              $round: [
                {
                  $arrayElemAt: [
                    "$sortedDurations",
                    { $floor: { $multiply: [{ $size: "$sortedDurations" }, 0.95] } },
                  ],
                },
                0,
              ],
            },
          },
        },
      ]),
      LogModel.aggregate([
        {
          $match: { ...baseMatch, timestamp: prevTimeFilter },
        },
        {
          $group: {
            _id: null,
            totalRequests: { $sum: 1 },
            failedRequests: {
              $sum: { $cond: [{ $gte: ["$data.network.status", 400] }, 1, 0] },
            },
          },
        },
      ]),
      LogModel.aggregate([
        {
          $match: { ...baseMatch, timestamp: timeFilter, "data.network.status": { $exists: true } },
        },
        {
          $group: {
            _id: "$data.network.status",
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        {
          $project: {
            status: "$_id",
            count: 1,
            _id: 0,
          },
        },
      ]),
    ]);

    const current = currentStats[0] || { totalRequests: 0, failedRequests: 0, avgDuration: 0, p95Duration: 0 };
    const previous = previousStats[0] || { totalRequests: 0, failedRequests: 0 };
    const failureRate = current.totalRequests > 0
      ? parseFloat(((current.failedRequests / current.totalRequests) * 100).toFixed(2))
      : 0;
    const prevFailureRate = previous.totalRequests > 0
      ? parseFloat(((previous.failedRequests / previous.totalRequests) * 100).toFixed(2))
      : 0;

    return {
      totalRequests: current.totalRequests,
      failedRequests: current.failedRequests,
      failureRate,
      avgDuration: current.avgDuration,
      p95Duration: current.p95Duration,
      statusDistribution,
      changes: {
        totalRequests: this.calculateChange(current.totalRequests, previous.totalRequests),
        failedRequests: this.calculateChange(current.failedRequests, previous.failedRequests),
        failureRate: this.calculateChange(failureRate, prevFailureRate),
      },
    };
  }

  static async getNetworkRequests(
    projectId: string,
    options: {
      timeRange: string;
      page: number;
      limit: number;
      status?: string;
      method?: string;
      search?: string;
    }
  ) {
    const { startDate, endDate } = this.parseTimeRange(options.timeRange);
    const match: any = {
      projectId,
      eventType: "network",
      timestamp: {
        $gte: startDate.toISOString(),
        $lte: endDate.toISOString(),
      },
    };

    if (options.status) {
      const statusCode = parseInt(options.status);
      if (!isNaN(statusCode)) {
        // Filter by status range (e.g. 2xx, 4xx, 5xx)
        const rangeStart = Math.floor(statusCode / 100) * 100;
        match["data.network.status"] = { $gte: rangeStart, $lt: rangeStart + 100 };
      }
    }

    if (options.method) {
      match["data.network.method"] = options.method.toUpperCase();
    }

    if (options.search) {
      match["data.network.url"] = { $regex: options.search, $options: "i" };
    }

    const skip = (options.page - 1) * options.limit;

    const [requests, total] = await Promise.all([
      LogModel.find(match)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(options.limit)
        .select("data.network timestamp")
        .lean(),
      LogModel.countDocuments(match),
    ]);

    return {
      requests: requests.map((r: any) => ({
        url: r.data?.network?.url,
        method: r.data?.network?.method,
        status: r.data?.network?.status,
        duration: r.data?.network?.duration,
        timestamp: r.timestamp,
      })),
      pagination: {
        current: options.page,
        total: Math.ceil(total / options.limit),
        count: requests.length,
        totalRecords: total,
      },
    };
  }

  static async getNetworkTimeline(
    projectId: string,
    options: { timeRange: string; granularity: "hour" | "day" }
  ) {
    const { startDate, endDate } = this.parseTimeRange(options.timeRange);
    const dateFormat =
      options.granularity === "hour" ? "%Y-%m-%dT%H:00:00Z" : "%Y-%m-%d";

    const timeline = await LogModel.aggregate([
      {
        $match: {
          projectId,
          eventType: "network",
          timestamp: {
            $gte: startDate.toISOString(),
            $lte: endDate.toISOString(),
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: dateFormat,
              date: { $toDate: "$timestamp" },
            },
          },
          totalRequests: { $sum: 1 },
          failedRequests: {
            $sum: { $cond: [{ $gte: ["$data.network.status", 400] }, 1, 0] },
          },
          avgDuration: { $avg: "$data.network.duration" },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          time: "$_id",
          totalRequests: 1,
          failedRequests: 1,
          avgDuration: { $round: [{ $ifNull: ["$avgDuration", 0] }, 0] },
          _id: 0,
        },
      },
    ]);

    return timeline;
  }

  static async getNetworkTopEndpoints(
    projectId: string,
    options: { timeRange: string; limit: number }
  ) {
    const { startDate, endDate } = this.parseTimeRange(options.timeRange);

    const endpoints = await LogModel.aggregate([
      {
        $match: {
          projectId,
          eventType: "network",
          timestamp: {
            $gte: startDate.toISOString(),
            $lte: endDate.toISOString(),
          },
          "data.network.url": { $exists: true },
        },
      },
      {
        $group: {
          _id: { url: "$data.network.url", method: "$data.network.method" },
          count: { $sum: 1 },
          avgDuration: { $avg: "$data.network.duration" },
          errors: {
            $sum: { $cond: [{ $gte: ["$data.network.status", 400] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          url: "$_id.url",
          method: "$_id.method",
          count: 1,
          avgDuration: { $round: [{ $ifNull: ["$avgDuration", 0] }, 0] },
          errorRate: {
            $round: [
              {
                $cond: [
                  { $gt: ["$count", 0] },
                  { $multiply: [{ $divide: ["$errors", "$count"] }, 100] },
                  0,
                ],
              },
              2,
            ],
          },
          _id: 0,
        },
      },
      { $sort: { count: -1 } },
      { $limit: options.limit },
    ]);

    return endpoints;
  }

  static async getNetworkSlowest(
    projectId: string,
    options: { timeRange: string; limit: number }
  ) {
    const { startDate, endDate } = this.parseTimeRange(options.timeRange);

    const endpoints = await LogModel.aggregate([
      {
        $match: {
          projectId,
          eventType: "network",
          timestamp: {
            $gte: startDate.toISOString(),
            $lte: endDate.toISOString(),
          },
          "data.network.duration": { $exists: true, $type: "number" },
        },
      },
      {
        $group: {
          _id: { url: "$data.network.url", method: "$data.network.method" },
          durations: { $push: "$data.network.duration" },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          sortedDurations: { $sortArray: { input: "$durations", sortBy: 1 } },
        },
      },
      {
        $project: {
          url: "$_id.url",
          method: "$_id.method",
          avgDuration: { $round: [{ $avg: "$durations" }, 0] },
          maxDuration: { $round: [{ $max: "$durations" }, 0] },
          p95Duration: {
            $round: [
              {
                $arrayElemAt: [
                  "$sortedDurations",
                  { $floor: { $multiply: [{ $size: "$sortedDurations" }, 0.95] } },
                ],
              },
              0,
            ],
          },
          count: 1,
          _id: 0,
        },
      },
      { $sort: { avgDuration: -1 } },
      { $limit: options.limit },
    ]);

    return endpoints;
  }

  // ============================================================================
  // INTERACTION ANALYTICS
  // ============================================================================

  static async getInteractionOverview(
    projectId: string,
    options: { timeRange: string }
  ) {
    const { startDate, endDate } = this.parseTimeRange(options.timeRange);
    const previousPeriod = this.getPreviousPeriod(startDate, endDate);
    const timeFilter = {
      $gte: startDate.toISOString(),
      $lte: endDate.toISOString(),
    };
    const prevTimeFilter = {
      $gte: previousPeriod.start.toISOString(),
      $lte: previousPeriod.end.toISOString(),
    };
    const baseMatch = { projectId, eventType: "interaction" };

    const [currentStats, previousStats] = await Promise.all([
      LogModel.aggregate([
        { $match: { ...baseMatch, timestamp: timeFilter } },
        {
          $group: {
            _id: "$data.interaction.type",
            count: { $sum: 1 },
          },
        },
      ]),
      LogModel.aggregate([
        { $match: { ...baseMatch, timestamp: prevTimeFilter } },
        {
          $group: {
            _id: "$data.interaction.type",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const currentMap: Record<string, number> = {};
    let currentTotal = 0;
    for (const s of currentStats) {
      currentMap[s._id || "unknown"] = s.count;
      currentTotal += s.count;
    }

    const previousMap: Record<string, number> = {};
    let previousTotal = 0;
    for (const s of previousStats) {
      previousMap[s._id || "unknown"] = s.count;
      previousTotal += s.count;
    }

    return {
      total: currentTotal,
      clicks: currentMap["click"] || 0,
      scrolls: currentMap["scroll"] || 0,
      keypresses: currentMap["keypress"] || 0,
      focuses: currentMap["focus"] || 0,
      blurs: currentMap["blur"] || 0,
      changes: {
        total: this.calculateChange(currentTotal, previousTotal),
        clicks: this.calculateChange(currentMap["click"] || 0, previousMap["click"] || 0),
        scrolls: this.calculateChange(currentMap["scroll"] || 0, previousMap["scroll"] || 0),
        keypresses: this.calculateChange(currentMap["keypress"] || 0, previousMap["keypress"] || 0),
      },
    };
  }

  static async getInteractionTimeline(
    projectId: string,
    options: { timeRange: string; granularity: "hour" | "day" }
  ) {
    const { startDate, endDate } = this.parseTimeRange(options.timeRange);
    const dateFormat =
      options.granularity === "hour" ? "%Y-%m-%dT%H:00:00Z" : "%Y-%m-%d";

    const timeline = await LogModel.aggregate([
      {
        $match: {
          projectId,
          eventType: "interaction",
          timestamp: {
            $gte: startDate.toISOString(),
            $lte: endDate.toISOString(),
          },
        },
      },
      {
        $group: {
          _id: {
            time: {
              $dateToString: {
                format: dateFormat,
                date: { $toDate: "$timestamp" },
              },
            },
            type: "$data.interaction.type",
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.time",
          clicks: {
            $sum: { $cond: [{ $eq: ["$_id.type", "click"] }, "$count", 0] },
          },
          scrolls: {
            $sum: { $cond: [{ $eq: ["$_id.type", "scroll"] }, "$count", 0] },
          },
          keypresses: {
            $sum: { $cond: [{ $eq: ["$_id.type", "keypress"] }, "$count", 0] },
          },
          total: { $sum: "$count" },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          time: "$_id",
          clicks: 1,
          scrolls: 1,
          keypresses: 1,
          total: 1,
          _id: 0,
        },
      },
    ]);

    return timeline;
  }

  static async getInteractionTopElements(
    projectId: string,
    options: { timeRange: string; limit: number }
  ) {
    const { startDate, endDate } = this.parseTimeRange(options.timeRange);

    const elements = await LogModel.aggregate([
      {
        $match: {
          projectId,
          eventType: "interaction",
          "data.interaction.type": "click",
          "data.interaction.target": { $exists: true, $ne: null },
          timestamp: {
            $gte: startDate.toISOString(),
            $lte: endDate.toISOString(),
          },
        },
      },
      {
        $group: {
          _id: "$data.interaction.target",
          count: { $sum: 1 },
          lastSeen: { $max: "$timestamp" },
        },
      },
      {
        $project: {
          target: "$_id",
          count: 1,
          lastSeen: 1,
          _id: 0,
        },
      },
      { $sort: { count: -1 } },
      { $limit: options.limit },
    ]);

    return elements;
  }

  static async getInteractionMostClicked(
    projectId: string,
    options: { timeRange: string; limit: number }
  ) {
    const { startDate, endDate } = this.parseTimeRange(options.timeRange);

    const elements = await LogModel.aggregate([
      {
        $match: {
          projectId,
          eventType: "interaction",
          "data.interaction.target": { $exists: true, $ne: null },
          timestamp: {
            $gte: startDate.toISOString(),
            $lte: endDate.toISOString(),
          },
        },
      },
      {
        $group: {
          _id: {
            target: "$data.interaction.target",
            type: "$data.interaction.type",
          },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          target: "$_id.target",
          type: "$_id.type",
          count: 1,
          _id: 0,
        },
      },
      { $sort: { count: -1 } },
      { $limit: options.limit },
    ]);

    return elements;
  }

  // ============================================================================
  // CONSOLE ANALYTICS
  // ============================================================================

  static async getConsoleOverview(
    projectId: string,
    options: { timeRange: string }
  ) {
    const { startDate, endDate } = this.parseTimeRange(options.timeRange);
    const previousPeriod = this.getPreviousPeriod(startDate, endDate);
    const timeFilter = {
      $gte: startDate.toISOString(),
      $lte: endDate.toISOString(),
    };
    const prevTimeFilter = {
      $gte: previousPeriod.start.toISOString(),
      $lte: previousPeriod.end.toISOString(),
    };
    const baseMatch = { projectId, eventType: "console" };

    const [currentStats, previousStats] = await Promise.all([
      LogModel.aggregate([
        { $match: { ...baseMatch, timestamp: timeFilter } },
        {
          $group: {
            _id: "$level",
            count: { $sum: 1 },
          },
        },
      ]),
      LogModel.aggregate([
        { $match: { ...baseMatch, timestamp: prevTimeFilter } },
        {
          $group: {
            _id: "$level",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const currentMap: Record<string, number> = {};
    let currentTotal = 0;
    for (const s of currentStats) {
      currentMap[s._id || "unknown"] = s.count;
      currentTotal += s.count;
    }

    const previousMap: Record<string, number> = {};
    let previousTotal = 0;
    for (const s of previousStats) {
      previousMap[s._id || "unknown"] = s.count;
      previousTotal += s.count;
    }

    return {
      total: currentTotal,
      byLevel: {
        error: currentMap["error"] || 0,
        warn: currentMap["warn"] || 0,
        info: currentMap["info"] || 0,
        debug: currentMap["debug"] || 0,
        trace: currentMap["trace"] || 0,
      },
      changes: {
        total: this.calculateChange(currentTotal, previousTotal),
        error: this.calculateChange(currentMap["error"] || 0, previousMap["error"] || 0),
        warn: this.calculateChange(currentMap["warn"] || 0, previousMap["warn"] || 0),
      },
    };
  }

  static async getConsoleMessages(
    projectId: string,
    options: {
      timeRange: string;
      page: number;
      limit: number;
      level?: string;
      search?: string;
    }
  ) {
    const { startDate, endDate } = this.parseTimeRange(options.timeRange);
    const match: any = {
      projectId,
      eventType: "console",
      timestamp: {
        $gte: startDate.toISOString(),
        $lte: endDate.toISOString(),
      },
    };

    if (options.level) {
      match.level = options.level;
    }

    if (options.search) {
      match.message = { $regex: options.search, $options: "i" };
    }

    const skip = (options.page - 1) * options.limit;

    const [logs, total] = await Promise.all([
      LogModel.find(match)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(options.limit)
        .select("level data.consoleArgs timestamp url message")
        .lean(),
      LogModel.countDocuments(match),
    ]);

    return {
      messages: logs.map((l: any) => ({
        level: l.level,
        message: Array.isArray(l.data?.consoleArgs)
          ? l.data.consoleArgs.join(" ")
          : l.message || "",
        timestamp: l.timestamp,
        url: l.url,
      })),
      pagination: {
        current: options.page,
        total: Math.ceil(total / options.limit),
        count: logs.length,
        totalRecords: total,
      },
    };
  }

  static async getConsoleTimeline(
    projectId: string,
    options: { timeRange: string; granularity: "hour" | "day" }
  ) {
    const { startDate, endDate } = this.parseTimeRange(options.timeRange);
    const dateFormat =
      options.granularity === "hour" ? "%Y-%m-%dT%H:00:00Z" : "%Y-%m-%d";

    const timeline = await LogModel.aggregate([
      {
        $match: {
          projectId,
          eventType: "console",
          timestamp: {
            $gte: startDate.toISOString(),
            $lte: endDate.toISOString(),
          },
        },
      },
      {
        $group: {
          _id: {
            time: {
              $dateToString: {
                format: dateFormat,
                date: { $toDate: "$timestamp" },
              },
            },
            level: "$level",
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.time",
          error: {
            $sum: { $cond: [{ $eq: ["$_id.level", "error"] }, "$count", 0] },
          },
          warn: {
            $sum: { $cond: [{ $eq: ["$_id.level", "warn"] }, "$count", 0] },
          },
          info: {
            $sum: { $cond: [{ $eq: ["$_id.level", "info"] }, "$count", 0] },
          },
          debug: {
            $sum: { $cond: [{ $eq: ["$_id.level", "debug"] }, "$count", 0] },
          },
          total: { $sum: "$count" },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          timestamp: "$_id",
          error: 1,
          warn: 1,
          info: 1,
          debug: 1,
          total: 1,
          _id: 0,
        },
      },
    ]);

    return timeline;
  }

  // ============================================================================
  // PAGEVIEW ANALYTICS
  // ============================================================================

  static async getPageviewOverview(
    projectId: string,
    options: { timeRange: string }
  ) {
    const { startDate, endDate } = this.parseTimeRange(options.timeRange);
    const previousPeriod = this.getPreviousPeriod(startDate, endDate);
    const timeFilter = {
      $gte: startDate.toISOString(),
      $lte: endDate.toISOString(),
    };
    const prevTimeFilter = {
      $gte: previousPeriod.start.toISOString(),
      $lte: previousPeriod.end.toISOString(),
    };
    const baseMatch = { projectId, eventType: "pageview" };

    const [currentStats, previousStats] = await Promise.all([
      LogModel.aggregate([
        { $match: { ...baseMatch, timestamp: timeFilter } },
        {
          $group: {
            _id: null,
            totalPageviews: { $sum: 1 },
            uniquePages: { $addToSet: { $ifNull: ["$data.url", "$url"] } },
          },
        },
        {
          $project: {
            _id: 0,
            totalPageviews: 1,
            uniquePages: { $size: "$uniquePages" },
          },
        },
      ]),
      LogModel.aggregate([
        { $match: { ...baseMatch, timestamp: prevTimeFilter } },
        {
          $group: {
            _id: null,
            totalPageviews: { $sum: 1 },
            uniquePages: { $addToSet: { $ifNull: ["$data.url", "$url"] } },
          },
        },
        {
          $project: {
            _id: 0,
            totalPageviews: 1,
            uniquePages: { $size: "$uniquePages" },
          },
        },
      ]),
    ]);

    // Get top page
    const topPageResult = await LogModel.aggregate([
      { $match: { ...baseMatch, timestamp: timeFilter } },
      {
        $group: {
          _id: { $ifNull: ["$data.url", "$url"] },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 1 },
      {
        $project: {
          url: "$_id",
          count: 1,
          _id: 0,
        },
      },
    ]);

    const current = currentStats[0] || { totalPageviews: 0, uniquePages: 0 };
    const previous = previousStats[0] || { totalPageviews: 0, uniquePages: 0 };

    return {
      totalPageviews: current.totalPageviews,
      uniquePages: current.uniquePages,
      topPage: topPageResult[0] || null,
      changes: {
        totalPageviews: this.calculateChange(current.totalPageviews, previous.totalPageviews),
        uniquePages: this.calculateChange(current.uniquePages, previous.uniquePages),
      },
    };
  }

  static async getPageviewTimeline(
    projectId: string,
    options: { timeRange: string; granularity: "hour" | "day" }
  ) {
    const { startDate, endDate } = this.parseTimeRange(options.timeRange);
    const dateFormat =
      options.granularity === "hour" ? "%Y-%m-%dT%H:00:00Z" : "%Y-%m-%d";

    const timeline = await LogModel.aggregate([
      {
        $match: {
          projectId,
          eventType: "pageview",
          timestamp: {
            $gte: startDate.toISOString(),
            $lte: endDate.toISOString(),
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: dateFormat,
              date: { $toDate: "$timestamp" },
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          time: "$_id",
          count: 1,
          _id: 0,
        },
      },
    ]);

    return timeline;
  }

  static async getPageviewTopPages(
    projectId: string,
    options: { timeRange: string; limit: number }
  ) {
    const { startDate, endDate } = this.parseTimeRange(options.timeRange);

    const pages = await LogModel.aggregate([
      {
        $match: {
          projectId,
          eventType: "pageview",
          timestamp: {
            $gte: startDate.toISOString(),
            $lte: endDate.toISOString(),
          },
        },
      },
      {
        $group: {
          _id: { $ifNull: ["$data.url", "$url"] },
          title: { $first: "$data.title" },
          views: { $sum: 1 },
          uniqueSessions: { $addToSet: SESSION_ID_EXPR },
        },
      },
      {
        $project: {
          url: "$_id",
          title: 1,
          views: 1,
          uniqueSessions: {
            $size: {
              $filter: {
                input: "$uniqueSessions",
                cond: { $ne: ["$$this", null] },
              },
            },
          },
          _id: 0,
        },
      },
      { $sort: { views: -1 } },
      { $limit: options.limit },
    ]);

    return pages;
  }

  static async getPageviewReferrers(
    projectId: string,
    options: { timeRange: string; limit: number }
  ) {
    const { startDate, endDate } = this.parseTimeRange(options.timeRange);

    const referrers = await LogModel.aggregate([
      {
        $match: {
          projectId,
          eventType: "pageview",
          timestamp: {
            $gte: startDate.toISOString(),
            $lte: endDate.toISOString(),
          },
          $or: [
            { "data.referrer": { $exists: true, $ne: "" } },
            { referrer: { $exists: true, $ne: "" } },
          ],
        },
      },
      {
        $group: {
          _id: { $ifNull: ["$data.referrer", "$referrer"] },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: options.limit },
    ]);

    // Calculate percentages
    const totalReferrals = referrers.reduce((sum: number, r: any) => sum + r.count, 0);

    return referrers.map((r: any) => ({
      referrer: r._id,
      count: r.count,
      percentage: totalReferrals > 0
        ? parseFloat(((r.count / totalReferrals) * 100).toFixed(2))
        : 0,
    }));
  }

  static async getPageviewNavigationFlow(
    projectId: string,
    options: { timeRange: string; limit: number }
  ) {
    const { startDate, endDate } = this.parseTimeRange(options.timeRange);

    const flows = await LogModel.aggregate([
      {
        $match: {
          projectId,
          eventType: "pageview",
          timestamp: {
            $gte: startDate.toISOString(),
            $lte: endDate.toISOString(),
          },
          ...HAS_SESSION_ID,
        },
      },
      {
        $addFields: {
          _resolvedSessionId: SESSION_ID_EXPR,
        },
      },
      { $sort: { _resolvedSessionId: 1, timestamp: 1 } },
      {
        $group: {
          _id: "$_resolvedSessionId",
          pages: {
            $push: { $ifNull: ["$data.url", "$url"] },
          },
        },
      },
      {
        $addFields: {
          pairs: {
            $reduce: {
              input: { $range: [0, { $subtract: [{ $size: "$pages" }, 1] }] },
              initialValue: [],
              in: {
                $concatArrays: [
                  "$$value",
                  [
                    {
                      from: { $arrayElemAt: ["$pages", "$$this"] },
                      to: {
                        $arrayElemAt: [
                          "$pages",
                          { $add: ["$$this", 1] },
                        ],
                      },
                    },
                  ],
                ],
              },
            },
          },
        },
      },
      { $unwind: "$pairs" },
      {
        $group: {
          _id: { from: "$pairs.from", to: "$pairs.to" },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          from: "$_id.from",
          to: "$_id.to",
          count: 1,
          _id: 0,
        },
      },
      { $sort: { count: -1 } },
      { $limit: options.limit },
    ]);

    return flows;
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  static async getDashboardOverview(
    projectId: string,
    options: { timeRange: string }
  ) {
    const [errorStats, performanceScore, activityStats, sessionStats] =
      await Promise.all([
        this.getErrorStats(projectId, options),
        this.getPerformanceScore(projectId, options),
        this.getActivityStats(projectId, options),
        this.getSessionStats(projectId, options),
      ]);

    return {
      errors: errorStats,
      performance: performanceScore,
      activity: activityStats,
      sessions: sessionStats,
    };
  }

  static async exportAnalytics(projectId: string, options: any) {
    // Implement export logic based on format
    const data = await this.getDashboardOverview(projectId, {
      timeRange: options.timeRange || "7d",
    });

    if (options.format === "csv") {
      // Convert to CSV format
      return this.convertToCSV(data);
    }

    return data;
  }

  static async getAlerts(projectId: string, options: any) {
    const query: any = {
      projectId,
      level: { $in: ["error", "fatal"] },
    };

    if (options.severity) {
      query.level = options.severity;
    }

    const alerts = await LogModel.find(query)
      .sort({ timestamp: -1 })
      .limit(50)
      .lean();

    return alerts.map((alert) => ({
      id: alert._id,
      severity: alert.level,
      message: alert.message,
      timestamp: alert.timestamp,
      status: "active",
      service: alert.service,
      environment: alert.environment,
    }));
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private static parseTimeRange(timeRange: string): {
    startDate: Date;
    endDate: Date;
  } {
    // Handle custom range format: "custom:ISO_START,ISO_END"
    if (timeRange.startsWith("custom:")) {
      const parts = timeRange.slice(7).split(",");
      if (parts.length === 2) {
        const s = new Date(parts[0]);
        const e = new Date(parts[1]);
        if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
          return { startDate: s, endDate: e };
        }
      }
    }

    const endDate = new Date();
    let startDate = new Date();

    const match = timeRange.match(/^(\d+)([hdwm])$/);
    if (!match) {
      // Default to 24 hours
      startDate.setHours(startDate.getHours() - 24);
      return { startDate, endDate };
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case "h":
        startDate.setHours(startDate.getHours() - value);
        break;
      case "d":
        startDate.setDate(startDate.getDate() - value);
        break;
      case "w":
        startDate.setDate(startDate.getDate() - value * 7);
        break;
      case "m":
        startDate.setMonth(startDate.getMonth() - value);
        break;
    }

    return { startDate, endDate };
  }

  private static getPreviousPeriod(startDate: Date, endDate: Date) {
    const duration = endDate.getTime() - startDate.getTime();
    return {
      start: new Date(startDate.getTime() - duration),
      end: new Date(startDate.getTime()),
    };
  }

  private static calculateChange(current: number, previous: number): string {
    if (previous === 0) return "+100%";
    const change = ((current - previous) / previous) * 100;
    return `${change > 0 ? "+" : ""}${change.toFixed(1)}%`;
  }

  private static async calculateErrorStats(
    projectId: string,
    startDate: Date,
    endDate: Date
  ) {
    const [totalLogs, errorLogs, uniqueUsers] = await Promise.all([
      LogModel.countDocuments({
        projectId,
        timestamp: {
          $gte: startDate.toISOString(),
          $lte: endDate.toISOString(),
        },
      }),
      LogModel.countDocuments({
        projectId,
        timestamp: {
          $gte: startDate.toISOString(),
          $lte: endDate.toISOString(),
        },
        level: { $in: ["error", "fatal"] },
      }),
      LogModel.distinct("context.userId", {
        projectId,
        timestamp: {
          $gte: startDate.toISOString(),
          $lte: endDate.toISOString(),
        },
        level: { $in: ["error", "fatal"] },
      }),
    ]);

    const errorRate = totalLogs > 0 ? (errorLogs / totalLogs) * 100 : 0;

    // Calculate MTTR (Mean Time To Resolution) - simplified
    const mttr = 24 * 60; // 24 minutes average (mock data)

    return {
      totalErrors: errorLogs,
      errorRate: parseFloat(errorRate.toFixed(2)),
      affectedUsers: uniqueUsers.length,
      mttr,
    };
  }

  private static calculateMetricScore(
    value: number,
    good: number,
    poor: number
  ): number {
    if (value <= good) return 100;
    if (value >= poor) return 0;
    return Math.round(100 - ((value - good) / (poor - good)) * 100);
  }

  private static convertToCSV(data: any): string {
    const rows: string[] = [];

    // Escape CSV values: handles commas, quotes, newlines
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

    // Flatten nested objects with dot notation
    const flatten = (obj: any, prefix = ""): Record<string, any> => {
      const result: Record<string, any> = {};
      for (const key of Object.keys(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];
        if (value !== null && typeof value === "object" && !Array.isArray(value)) {
          Object.assign(result, flatten(value, fullKey));
        } else if (Array.isArray(value)) {
          result[fullKey] = JSON.stringify(value);
        } else {
          result[fullKey] = value;
        }
      }
      return result;
    };

    const flat = flatten(data);
    rows.push("Metric,Value");
    for (const [key, value] of Object.entries(flat)) {
      rows.push(`${escape(key)},${escape(value)}`);
    }

    return rows.join("\n");
  }
}
