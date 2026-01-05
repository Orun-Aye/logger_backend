// src/services/analytics.service.ts
import { LogModel } from "../models/log.model";
import { LogLevel } from "../dtos/log.dto";

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

    const timeline = await LogModel.aggregate([
      {
        $match: {
          projectId,
          timestamp: {
            $gte: startDate.toISOString(),
            $lte: endDate.toISOString(),
          },
          eventType: "performance",
          responseTime: { $exists: true, $type: "number" },
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
                { $eq: ["$data.performance.type", "navigation"] },
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
          ttfb: { $avg: "$responseTime" },
          cls: { $avg: "$data.performance.cls" },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          time: "$_id",
          lcp: { $round: ["$lcp", 0] },
          fcp: { $round: ["$fcp", 0] },
          ttfb: { $round: ["$ttfb", 0] },
          cls: { $round: ["$cls", 3] },
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
          eventType: "performance",
        },
      },
      {
        $group: {
          _id: null,
          lcp: {
            $push: {
              $cond: [
                { $eq: ["$data.performance.type", "navigation"] },
                "$data.performance.duration",
                null,
              ],
            },
          },
          fcp: {
            $push: {
              $cond: [
                { $eq: ["$data.performance.type", "paint"] },
                "$data.performance.duration",
                null,
              ],
            },
          },
          cls: { $push: "$data.performance.cls" },
        },
      },
      {
        $project: {
          lcp: {
            p75: {
              $arrayElemAt: [
                "$lcp",
                { $floor: { $multiply: [{ $size: "$lcp" }, 0.75] } },
              ],
            },
            avg: { $avg: "$lcp" },
          },
          fcp: {
            p75: {
              $arrayElemAt: [
                "$fcp",
                { $floor: { $multiply: [{ $size: "$fcp" }, 0.75] } },
              ],
            },
            avg: { $avg: "$fcp" },
          },
          cls: {
            p75: {
              $arrayElemAt: [
                "$cls",
                { $floor: { $multiply: [{ $size: "$cls" }, 0.75] } },
              ],
            },
            avg: { $avg: "$cls" },
          },
        },
      },
    ]);

    return vitals[0] || { lcp: {}, fcp: {}, cls: {} };
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
          responseTime: { $exists: true, $type: "number" },
        },
      },
      {
        $group: {
          _id: "$data.network.url",
          calls: { $sum: 1 },
          responseTimes: { $push: "$responseTime" },
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
          cls: { $avg: "$data.performance.cls" },
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
          cls: { $round: ["$cls", 3] },
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

    const metrics = await LogModel.aggregate([
      {
        $match: {
          projectId,
          timestamp: {
            $gte: startDate.toISOString(),
            $lte: endDate.toISOString(),
          },
          eventType: "performance",
        },
      },
      {
        $group: {
          _id: null,
          avgLoadTime: { $avg: "$data.performance.duration" },
          avgLCP: {
            $avg: {
              $cond: [
                { $eq: ["$data.performance.type", "navigation"] },
                "$data.performance.duration",
                null,
              ],
            },
          },
          avgFCP: {
            $avg: {
              $cond: [
                { $eq: ["$data.performance.type", "paint"] },
                "$data.performance.duration",
                null,
              ],
            },
          },
          avgCLS: { $avg: "$data.performance.cls" },
        },
      },
    ]);

    if (!metrics[0]) {
      return { score: 0, grade: "N/A", breakdown: {} };
    }

    const { avgLoadTime, avgLCP, avgFCP, avgCLS } = metrics[0];

    // Calculate score (0-100)
    const scores = {
      loadTime: this.calculateMetricScore(avgLoadTime, 1000, 3000),
      lcp: this.calculateMetricScore(avgLCP, 2500, 4000),
      fcp: this.calculateMetricScore(avgFCP, 1800, 3000),
      cls: this.calculateMetricScore(avgCLS, 0.1, 0.25),
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
        loadTime: { score: scores.loadTime, value: Math.round(avgLoadTime) },
        lcp: { score: scores.lcp, value: Math.round(avgLCP) },
        fcp: { score: scores.fcp, value: Math.round(avgFCP) },
        cls: { score: scores.cls, value: avgCLS?.toFixed(3) },
      },
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
          responseTime: { $exists: true, $type: "number" },
        },
      },
      {
        $group: {
          _id: "$data.network.url",
          avgDuration: { $avg: "$responseTime" },
          maxDuration: { $max: "$responseTime" },
          calls: { $sum: 1 },
          method: { $first: "$data.network.method" },
        },
      },
      {
        $project: {
          url: "$_id",
          avgDuration: { $round: ["$avgDuration", 0] },
          maxDuration: { $round: ["$maxDuration", 0] },
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

    const stats = await LogModel.aggregate([
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
          _id: "$level",
          count: { $sum: 1 },
        },
      },
    ]);

    return stats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {} as Record<string, number>);
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
          "context.sessionId": { $exists: true },
        },
      },
      {
        $group: {
          _id: "$context.sessionId",
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

    const total = await LogModel.distinct("context.sessionId", {
      projectId,
      timestamp: { $gte: startDate.toISOString(), $lte: endDate.toISOString() },
    }).then((ids) => ids.length);

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
      "context.sessionId": sessionId,
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
      "context.sessionId": sessionId,
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
          "context.sessionId": { $exists: true },
        },
      },
      {
        $group: {
          _id: "$context.sessionId",
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
          "context.sessionId": { $exists: true },
        },
      },
      {
        $group: {
          _id: "$context.sessionId",
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
    // Simple CSV conversion - can be enhanced
    const rows: string[] = [];

    // Add headers
    rows.push("Metric,Value");

    // Add data rows
    Object.keys(data).forEach((key) => {
      if (typeof data[key] === "object") {
        Object.keys(data[key]).forEach((subKey) => {
          rows.push(`${key}.${subKey},${data[key][subKey]}`);
        });
      } else {
        rows.push(`${key},${data[key]}`);
      }
    });

    return rows.join("\n");
  }
}
