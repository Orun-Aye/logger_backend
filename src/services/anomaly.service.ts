import { AnomalyModel, AnomalyType, AnomalySeverity } from "../models/anomaly.model";
import { LogModel } from "../models/log.model";
import { AnomalyFilters, AnomalyStats, CreateAnomalyInput } from "../dtos/anomaly.dto";
import logger from "../utils/logger";

export class AnomalyService {
  /**
   * Scan a project for all anomaly types
   */
  static async scanProject(projectId: string): Promise<number> {
    let detected = 0;

    try {
      const results = await Promise.allSettled([
        this.detectLogVolumeSpike(projectId),
        this.detectErrorRateIncrease(projectId),
        this.detectResponseTimeDegradation(projectId),
        this.detectErrorSpike(projectId),
      ]);

      for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
          detected++;
        }
      }

      logger.info(`Anomaly scan complete for project ${projectId}: ${detected} anomalies detected`);
    } catch (error) {
      logger.error(`Anomaly scan failed for project ${projectId}`, { error });
    }

    return detected;
  }

  /**
   * Log volume spike: compare last-hour log count against 7-day hourly average
   * Flag if > 3 standard deviations
   */
  private static async detectLogVolumeSpike(projectId: string): Promise<boolean> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Current hour count
    const currentCount = await LogModel.countDocuments({
      projectId,
      createdAt: { $gte: oneHourAgo, $lte: now },
    });

    // 7-day hourly average using aggregation
    const baseline = await LogModel.aggregate([
      {
        $match: {
          projectId,
          createdAt: { $gte: sevenDaysAgo, $lt: oneHourAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d-%H", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: null,
          mean: { $avg: "$count" },
          stdDev: { $stdDevPop: "$count" },
          sampleSize: { $sum: 1 },
        },
      },
    ]);

    if (!baseline.length || baseline[0].sampleSize < 24) return false;

    const { mean, stdDev } = baseline[0];
    if (stdDev === 0) return false;

    const deviation = (currentCount - mean) / stdDev;

    if (deviation > 3) {
      const percentChange = mean > 0 ? ((currentCount - mean) / mean) * 100 : 0;
      const severity: AnomalySeverity = deviation > 5 ? "critical" : "warning";

      await this.createAnomaly({
        projectId,
        type: "log_volume_spike",
        severity,
        metric: "log_volume_hourly",
        currentValue: currentCount,
        baselineValue: Math.round(mean * 100) / 100,
        deviation: Math.round(deviation * 100) / 100,
        percentChange: Math.round(percentChange * 100) / 100,
        description: `Log volume spiked to ${currentCount} logs/hr (baseline: ${Math.round(mean)} logs/hr, ${Math.round(deviation * 10) / 10}σ above normal)`,
      });

      return true;
    }

    return false;
  }

  /**
   * Error rate increase: compare last-hour error rate against 7-day rolling average
   * Flag if > 2.5 standard deviations
   */
  private static async detectErrorRateIncrease(projectId: string): Promise<boolean> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Current hour error rate
    const [currentStats] = await LogModel.aggregate([
      {
        $match: {
          projectId,
          createdAt: { $gte: oneHourAgo, $lte: now },
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
    ]);

    if (!currentStats || currentStats.total < 10) return false;

    const currentErrorRate = (currentStats.errors / currentStats.total) * 100;

    // 7-day hourly error rates
    const baselineRates = await LogModel.aggregate([
      {
        $match: {
          projectId,
          createdAt: { $gte: sevenDaysAgo, $lt: oneHourAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d-%H", date: "$createdAt" },
          },
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
              { $multiply: [{ $divide: ["$errors", "$total"] }, 100] },
              0,
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          mean: { $avg: "$errorRate" },
          stdDev: { $stdDevPop: "$errorRate" },
          sampleSize: { $sum: 1 },
        },
      },
    ]);

    if (!baselineRates.length || baselineRates[0].sampleSize < 24) return false;

    const { mean, stdDev } = baselineRates[0];
    if (stdDev === 0) return false;

    const deviation = (currentErrorRate - mean) / stdDev;

    if (deviation > 2.5) {
      const percentChange = mean > 0 ? ((currentErrorRate - mean) / mean) * 100 : 0;
      const severity: AnomalySeverity = deviation > 4 ? "critical" : "warning";

      await this.createAnomaly({
        projectId,
        type: "error_rate_increase",
        severity,
        metric: "error_rate_hourly",
        currentValue: Math.round(currentErrorRate * 100) / 100,
        baselineValue: Math.round(mean * 100) / 100,
        deviation: Math.round(deviation * 100) / 100,
        percentChange: Math.round(percentChange * 100) / 100,
        description: `Error rate increased to ${Math.round(currentErrorRate * 10) / 10}% (baseline: ${Math.round(mean * 10) / 10}%, ${Math.round(deviation * 10) / 10}σ above normal)`,
      });

      return true;
    }

    return false;
  }

  /**
   * Response time degradation: compare last-hour p95 against 7-day baseline
   * Flag if > 2 standard deviations
   */
  private static async detectResponseTimeDegradation(projectId: string): Promise<boolean> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Current hour p95
    const currentTimes = await LogModel.aggregate([
      {
        $match: {
          projectId,
          createdAt: { $gte: oneHourAgo, $lte: now },
          eventType: "network",
          "data.network.duration": { $exists: true, $type: "number" },
        },
      },
      { $sort: { "data.network.duration": 1 } },
      {
        $group: {
          _id: null,
          times: { $push: "$data.network.duration" },
          count: { $sum: 1 },
        },
      },
    ]);

    if (!currentTimes.length || currentTimes[0].count < 10) return false;

    const sorted = currentTimes[0].times;
    const currentP95 = sorted[Math.floor(sorted.length * 0.95)];

    // 7-day hourly p95 values
    const baselineP95s = await LogModel.aggregate([
      {
        $match: {
          projectId,
          createdAt: { $gte: sevenDaysAgo, $lt: oneHourAgo },
          eventType: "network",
          "data.network.duration": { $exists: true, $type: "number" },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d-%H", date: "$createdAt" },
          },
          times: { $push: "$data.network.duration" },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gte: 5 } } },
      {
        $project: {
          p95: {
            $arrayElemAt: [
              "$times",
              { $floor: { $multiply: [{ $size: "$times" }, 0.95] } },
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          mean: { $avg: "$p95" },
          stdDev: { $stdDevPop: "$p95" },
          sampleSize: { $sum: 1 },
        },
      },
    ]);

    if (!baselineP95s.length || baselineP95s[0].sampleSize < 24) return false;

    const { mean, stdDev } = baselineP95s[0];
    if (stdDev === 0) return false;

    const deviation = (currentP95 - mean) / stdDev;

    if (deviation > 2) {
      const percentChange = mean > 0 ? ((currentP95 - mean) / mean) * 100 : 0;
      const severity: AnomalySeverity = deviation > 3.5 ? "critical" : "warning";

      await this.createAnomaly({
        projectId,
        type: "response_time_degradation",
        severity,
        metric: "p95_response_time",
        currentValue: Math.round(currentP95),
        baselineValue: Math.round(mean),
        deviation: Math.round(deviation * 100) / 100,
        percentChange: Math.round(percentChange * 100) / 100,
        description: `P95 response time degraded to ${Math.round(currentP95)}ms (baseline: ${Math.round(mean)}ms, ${Math.round(deviation * 10) / 10}σ above normal)`,
      });

      return true;
    }

    return false;
  }

  /**
   * Error spike: compare last-15-minute error count against last-hour average
   * Flag if > 4x
   */
  private static async detectErrorSpike(projectId: string): Promise<boolean> {
    const now = new Date();
    const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const [stats] = await LogModel.aggregate([
      {
        $match: {
          projectId,
          level: { $in: ["error", "fatal"] },
          createdAt: { $gte: oneHourAgo, $lte: now },
        },
      },
      {
        $facet: {
          recentErrors: [
            { $match: { createdAt: { $gte: fifteenMinAgo } } },
            { $count: "count" },
          ],
          hourlyErrors: [{ $count: "count" }],
        },
      },
    ]);

    const recentCount = stats?.recentErrors?.[0]?.count || 0;
    const hourlyCount = stats?.hourlyErrors?.[0]?.count || 0;

    if (hourlyCount < 4 || recentCount < 3) return false;

    // Normalize to 15-min rate: hourly / 4
    const expectedPer15Min = hourlyCount / 4;
    const ratio = recentCount / expectedPer15Min;

    if (ratio > 4) {
      const severity: AnomalySeverity = ratio > 8 ? "critical" : "warning";

      await this.createAnomaly({
        projectId,
        type: "error_spike",
        severity,
        metric: "error_count_15m",
        currentValue: recentCount,
        baselineValue: Math.round(expectedPer15Min * 100) / 100,
        deviation: Math.round(ratio * 100) / 100,
        percentChange: Math.round((ratio - 1) * 100),
        description: `Error spike detected: ${recentCount} errors in the last 15 minutes (${Math.round(ratio)}x above hourly average)`,
      });

      return true;
    }

    return false;
  }

  /**
   * Persist a new anomaly (deduplicates recent identical anomalies)
   */
  private static async createAnomaly(data: CreateAnomalyInput): Promise<void> {
    // Avoid duplicate anomalies: skip if same type was detected for this project in the last 30 min
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    const existing = await AnomalyModel.findOne({
      projectId: data.projectId,
      type: data.type,
      resolvedAt: null,
      detectedAt: { $gte: thirtyMinAgo },
    });

    if (existing) {
      logger.debug(`Skipping duplicate anomaly: ${data.type} for ${data.projectId}`);
      return;
    }

    await AnomalyModel.create({
      ...data,
      detectedAt: new Date(),
    });

    logger.warn(`Anomaly detected: ${data.type} [${data.severity}] for project ${data.projectId}`, {
      metric: data.metric,
      currentValue: data.currentValue,
      baselineValue: data.baselineValue,
      deviation: data.deviation,
    });
  }

  /**
   * Query persisted anomalies with filters
   */
  static async getAnomalies(projectId: string, filters: AnomalyFilters = {}) {
    const query: any = { projectId };

    if (filters.type) query.type = filters.type;
    if (filters.severity) query.severity = filters.severity;
    if (filters.acknowledged !== undefined) query.acknowledged = filters.acknowledged;
    if (filters.resolved === true) query.resolvedAt = { $ne: null };
    if (filters.resolved === false) query.resolvedAt = null;

    if (filters.startDate || filters.endDate) {
      query.detectedAt = {};
      if (filters.startDate) query.detectedAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.detectedAt.$lte = new Date(filters.endDate);
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const [anomalies, total] = await Promise.all([
      AnomalyModel.find(query)
        .sort({ detectedAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      AnomalyModel.countDocuments(query),
    ]);

    return { anomalies, total, limit, offset };
  }

  /**
   * Acknowledge an anomaly
   */
  static async acknowledgeAnomaly(anomalyId: string, userId: string) {
    const anomaly = await AnomalyModel.findByIdAndUpdate(
      anomalyId,
      { acknowledged: true, acknowledgedBy: userId },
      { new: true }
    );

    if (!anomaly) throw new Error("Anomaly not found");
    return anomaly;
  }

  /**
   * Resolve an anomaly
   */
  static async resolveAnomaly(anomalyId: string) {
    const anomaly = await AnomalyModel.findByIdAndUpdate(
      anomalyId,
      { resolvedAt: new Date() },
      { new: true }
    );

    if (!anomaly) throw new Error("Anomaly not found");
    return anomaly;
  }

  /**
   * Get anomaly stats for a project
   */
  static async getAnomalyStats(projectId: string): Promise<AnomalyStats> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [stats] = await AnomalyModel.aggregate([
      { $match: { projectId } },
      {
        $facet: {
          total: [{ $count: "count" }],
          openCritical: [
            { $match: { severity: "critical", resolvedAt: null } },
            { $count: "count" },
          ],
          openWarnings: [
            { $match: { severity: "warning", resolvedAt: null } },
            { $count: "count" },
          ],
          openInfo: [
            { $match: { severity: "info", resolvedAt: null } },
            { $count: "count" },
          ],
          resolvedToday: [
            { $match: { resolvedAt: { $gte: todayStart } } },
            { $count: "count" },
          ],
          byType: [
            { $group: { _id: "$type", count: { $sum: 1 } } },
          ],
        },
      },
    ]);

    const byType: Record<string, number> = {};
    if (stats?.byType) {
      for (const t of stats.byType) {
        byType[t._id] = t.count;
      }
    }

    return {
      total: stats?.total?.[0]?.count || 0,
      openCritical: stats?.openCritical?.[0]?.count || 0,
      openWarnings: stats?.openWarnings?.[0]?.count || 0,
      openInfo: stats?.openInfo?.[0]?.count || 0,
      resolvedToday: stats?.resolvedToday?.[0]?.count || 0,
      byType: byType as Record<AnomalyType, number>,
    };
  }

  /**
   * Auto-resolve anomalies whose metrics have returned to normal
   */
  static async autoResolveNormalized(projectId: string): Promise<number> {
    // Resolve open anomalies older than 2 hours (metrics have stabilized)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const result = await AnomalyModel.updateMany(
      {
        projectId,
        resolvedAt: null,
        detectedAt: { $lt: twoHoursAgo },
      },
      { resolvedAt: new Date() }
    );

    return result.modifiedCount;
  }
}
