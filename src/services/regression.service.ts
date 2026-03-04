import { LogModel } from "../models/log.model";
import { MetricComparison, RegressionResult, PerformanceBaseline } from "../dtos/regression.dto";

export class RegressionServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegressionServiceError";
  }
}

function parseTimeRange(timeRange: string): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  const startDate = new Date();
  const match = timeRange.match(/^(\d+)([hdwm])$/);
  if (!match) { startDate.setHours(startDate.getHours() - 24); return { startDate, endDate }; }
  const value = parseInt(match[1]);
  const unit = match[2];
  switch (unit) {
    case "h": startDate.setHours(startDate.getHours() - value); break;
    case "d": startDate.setDate(startDate.getDate() - value); break;
    case "w": startDate.setDate(startDate.getDate() - value * 7); break;
    case "m": startDate.setMonth(startDate.getMonth() - value); break;
  }
  return { startDate, endDate };
}

export class RegressionService {
  /**
   * Automatically detect performance regressions by comparing current period vs baseline
   */
  static async detectRegressions(
    projectId: string,
    options: {
      currentPeriod?: string;
      baselinePeriod?: string;
      threshold?: number;
      metrics?: string[];
    } = {}
  ): Promise<RegressionResult> {
    try {
      const currentPeriod = options.currentPeriod || "24h";
      const baselinePeriod = options.baselinePeriod || "7d";
      const threshold = options.threshold || 20;
      const metricsToCheck = options.metrics || ["responseTime", "errorRate", "p95", "logVolume"];

      const currentRange = parseTimeRange(currentPeriod);
      const baselineRange = parseTimeRange(baselinePeriod);

      // Adjust baseline to exclude current period
      baselineRange.endDate = currentRange.startDate;

      const [currentStats, baselineStats] = await Promise.all([
        this.computeMetrics(projectId, currentRange.startDate, currentRange.endDate),
        this.computeMetrics(projectId, baselineRange.startDate, baselineRange.endDate),
      ]);

      const regressions: MetricComparison[] = [];

      for (const metric of metricsToCheck) {
        const currentVal = (currentStats as any)[metric] || 0;
        const baselineVal = (baselineStats as any)[metric] || 0;
        const baselineStdDev = (baselineStats as any)[`${metric}StdDev`] || 1;

        const percentChange = baselineVal !== 0 ? ((currentVal - baselineVal) / baselineVal) * 100 : 0;
        const stdDevs = baselineStdDev > 0 ? (currentVal - baselineVal) / baselineStdDev : 0;

        // For error rate and response time, increase = degradation
        // For log volume, big change in either direction is notable
        const isDegraded = metric === "logVolume"
          ? Math.abs(percentChange) > threshold
          : percentChange > threshold;

        const isImproved = metric === "logVolume" ? false : percentChange < -threshold;

        let status: "improved" | "degraded" | "stable";
        if (isDegraded) status = "degraded";
        else if (isImproved) status = "improved";
        else status = "stable";

        let severity: "critical" | "warning" | "normal";
        if (Math.abs(stdDevs) > 3 || Math.abs(percentChange) > 50) severity = "critical";
        else if (Math.abs(stdDevs) > 2 || Math.abs(percentChange) > threshold) severity = "warning";
        else severity = "normal";

        regressions.push({
          metric,
          currentValue: Math.round(currentVal * 100) / 100,
          baselineValue: Math.round(baselineVal * 100) / 100,
          percentChange: Math.round(percentChange * 100) / 100,
          standardDeviations: Math.round(stdDevs * 100) / 100,
          status,
          severity,
        });
      }

      return {
        regressions,
        summary: {
          totalMetrics: regressions.length,
          degradedCount: regressions.filter((r) => r.status === "degraded").length,
          improvedCount: regressions.filter((r) => r.status === "improved").length,
          stableCount: regressions.filter((r) => r.status === "stable").length,
        },
      };
    } catch (error) {
      throw new RegressionServiceError(`Failed to detect regressions: ${error}`);
    }
  }

  /**
   * Get performance baseline metrics for a project
   */
  static async getBaseline(
    projectId: string,
    options: { period?: string } = {}
  ): Promise<PerformanceBaseline[]> {
    try {
      const { startDate, endDate } = parseTimeRange(options.period || "7d");

      const pipeline = [
        {
          $match: {
            projectId,
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: null,
            avgResponseTime: { $avg: { $cond: [{ $isNumber: "$responseTime" }, "$responseTime", null] } },
            stdDevResponseTime: { $stdDevPop: { $cond: [{ $isNumber: "$responseTime" }, "$responseTime", null] } },
            responseTimes: { $push: { $cond: [{ $isNumber: "$responseTime" }, "$responseTime", "$$REMOVE"] } },
            totalLogs: { $sum: 1 },
            errorCount: { $sum: { $cond: [{ $in: ["$level", ["error", "fatal"]] }, 1, 0] } },
          },
        },
      ];

      const [result] = await LogModel.aggregate(pipeline);
      if (!result) return [];

      const sortedTimes = (result.responseTimes || []).sort((a: number, b: number) => a - b);
      const len = sortedTimes.length;

      const baselines: PerformanceBaseline[] = [
        {
          metric: "responseTime",
          mean: result.avgResponseTime || 0,
          stdDev: result.stdDevResponseTime || 0,
          p50: len > 0 ? sortedTimes[Math.floor(len * 0.5)] : 0,
          p95: len > 0 ? sortedTimes[Math.floor(len * 0.95)] : 0,
          p99: len > 0 ? sortedTimes[Math.floor(len * 0.99)] : 0,
          sampleSize: len,
        },
        {
          metric: "errorRate",
          mean: result.totalLogs > 0 ? (result.errorCount / result.totalLogs) * 100 : 0,
          stdDev: 0,
          p50: 0,
          p95: 0,
          p99: 0,
          sampleSize: result.totalLogs,
        },
      ];

      return baselines;
    } catch (error) {
      throw new RegressionServiceError(`Failed to get baseline: ${error}`);
    }
  }

  /**
   * Compare performance between two arbitrary time periods
   */
  static async comparePerformance(
    projectId: string,
    options: { currentPeriod: string; baselinePeriod: string; metrics?: string[] }
  ): Promise<MetricComparison[]> {
    const result = await this.detectRegressions(projectId, {
      currentPeriod: options.currentPeriod,
      baselinePeriod: options.baselinePeriod,
      metrics: options.metrics,
    });
    return result.regressions;
  }

  /**
   * Compute aggregate metrics for a time range
   */
  private static async computeMetrics(projectId: string, startDate: Date, endDate: Date) {
    const pipeline = [
      {
        $match: {
          projectId,
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          totalLogs: { $sum: 1 },
          errorCount: { $sum: { $cond: [{ $in: ["$level", ["error", "fatal"]] }, 1, 0] } },
          responseTime: { $avg: { $cond: [{ $isNumber: "$responseTime" }, "$responseTime", null] } },
          responseTimeStdDev: { $stdDevPop: { $cond: [{ $isNumber: "$responseTime" }, "$responseTime", null] } },
          responseTimes: { $push: { $cond: [{ $isNumber: "$responseTime" }, "$responseTime", "$$REMOVE"] } },
        },
      },
    ];

    const [result] = await LogModel.aggregate(pipeline);
    if (!result) return { responseTime: 0, errorRate: 0, p95: 0, p99: 0, logVolume: 0 };

    const sortedTimes = (result.responseTimes || []).sort((a: number, b: number) => a - b);
    const len = sortedTimes.length;

    return {
      responseTime: result.responseTime || 0,
      responseTimeStdDev: result.responseTimeStdDev || 0,
      errorRate: result.totalLogs > 0 ? (result.errorCount / result.totalLogs) * 100 : 0,
      errorRateStdDev: 1,
      p95: len > 0 ? sortedTimes[Math.floor(len * 0.95)] : 0,
      p95StdDev: 1,
      p99: len > 0 ? sortedTimes[Math.floor(len * 0.99)] : 0,
      p99StdDev: 1,
      logVolume: result.totalLogs,
      logVolumeStdDev: Math.sqrt(result.totalLogs) || 1,
    };
  }
}
