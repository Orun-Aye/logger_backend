import { LogModel } from "../models/log.model";
import { AlertRuleModel } from "../models/alertRule.model";
import { AlertSuggestion } from "../dtos/aiSuggestion.dto";

export class AISuggestionServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AISuggestionServiceError";
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

export class AISuggestionService {
  /**
   * Generate rule-based alert suggestions by analyzing log patterns.
   * Always works -- no external API required.
   */
  static async suggestAlertRules(projectId: string, options?: { limit?: number }): Promise<AlertSuggestion[]> {
    try {
      const limit = options?.limit || 10;
      const { startDate, endDate } = parseTimeRange("7d");
      const suggestions: AlertSuggestion[] = [];

      // Get existing rules to avoid duplicates
      const existingRules = await AlertRuleModel.find({ projectId }).lean();
      const existingKeywords = new Set(existingRules.map((r: any) => r.condition?.keyword?.toLowerCase()).filter(Boolean));

      // 1. Detect recurring error messages
      const recurringErrors = await LogModel.aggregate([
        {
          $match: {
            projectId,
            level: { $in: ["error", "fatal"] },
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        { $group: { _id: "$message", count: { $sum: 1 }, lastSeen: { $max: "$createdAt" } } },
        { $match: { count: { $gte: 5 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]);

      for (const error of recurringErrors) {
        const keyword = error._id?.substring(0, 100);
        if (!keyword || existingKeywords.has(keyword.toLowerCase())) continue;

        suggestions.push({
          condition: { level: "error", keyword },
          suggestedName: `Alert: ${keyword.substring(0, 50)}`,
          reason: `This error occurred ${error.count} times in the last 7 days`,
          confidence: Math.min(error.count / 50, 1) * 100,
          priority: error.count > 50 ? "high" : error.count > 20 ? "medium" : "low",
        });
      }

      // 2. Detect services with high error rates
      const serviceErrors = await LogModel.aggregate([
        {
          $match: {
            projectId,
            createdAt: { $gte: startDate, $lte: endDate },
            service: { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: "$service",
            total: { $sum: 1 },
            errors: { $sum: { $cond: [{ $in: ["$level", ["error", "fatal"]] }, 1, 0] } },
          },
        },
        { $match: { total: { $gte: 10 } } },
        { $addFields: { errorRate: { $multiply: [{ $divide: ["$errors", "$total"] }, 100] } } },
        { $match: { errorRate: { $gt: 10 } } },
        { $sort: { errorRate: -1 } },
        { $limit: 3 },
      ]);

      for (const svc of serviceErrors) {
        suggestions.push({
          condition: { level: "error", service: svc._id },
          suggestedName: `High error rate: ${svc._id}`,
          reason: `Service "${svc._id}" has a ${Math.round(svc.errorRate)}% error rate (${svc.errors}/${svc.total} logs)`,
          confidence: Math.min(svc.errorRate / 30, 1) * 100,
          priority: svc.errorRate > 25 ? "high" : "medium",
        });
      }

      // 3. Detect slow endpoints (response time > 2000ms p95)
      // Read SDK-emitted network duration; the top-level `responseTime` field
      // is never populated by the SDK and was always returning empty results.
      const slowEndpoints = await LogModel.aggregate([
        {
          $match: {
            projectId,
            createdAt: { $gte: startDate, $lte: endDate },
            "data.network.duration": { $exists: true, $type: "number" },
          },
        },
        {
          $group: {
            _id: "$url",
            avgResponseTime: { $avg: "$data.network.duration" },
            maxResponseTime: { $max: "$data.network.duration" },
            count: { $sum: 1 },
          },
        },
        { $match: { avgResponseTime: { $gt: 2000 }, count: { $gte: 5 } } },
        { $sort: { avgResponseTime: -1 } },
        { $limit: 3 },
      ]);

      for (const endpoint of slowEndpoints) {
        if (!endpoint._id) continue;
        suggestions.push({
          condition: { responseTimeThreshold: 2000 },
          suggestedName: `Slow endpoint: ${endpoint._id.substring(0, 50)}`,
          reason: `Average response time is ${Math.round(endpoint.avgResponseTime)}ms (${endpoint.count} requests)`,
          confidence: 80,
          priority: endpoint.avgResponseTime > 5000 ? "high" : "medium",
        });
      }

      // 4. Detect error spikes (hourly error count > 3x daily average)
      const hourlyErrors = await LogModel.aggregate([
        {
          $match: {
            projectId,
            level: { $in: ["error", "fatal"] },
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d-%H", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
      ]);

      if (hourlyErrors.length > 0) {
        const avgHourlyErrors = hourlyErrors.reduce((s, h) => s + h.count, 0) / hourlyErrors.length;
        const maxHour = hourlyErrors.reduce((max, h) => (h.count > max.count ? h : max), hourlyErrors[0]);

        if (maxHour.count > avgHourlyErrors * 3 && avgHourlyErrors > 1) {
          suggestions.push({
            condition: { level: "error", frequency: Math.ceil(avgHourlyErrors * 3), intervalMinutes: 60 },
            suggestedName: "Error spike detection",
            reason: `Peak: ${maxHour.count} errors/hour vs ${Math.round(avgHourlyErrors)} average. Threshold set at 3x average.`,
            confidence: 85,
            priority: "high",
          });
        }
      }

      return suggestions.slice(0, limit);
    } catch (error) {
      throw new AISuggestionServiceError(`Failed to generate suggestions: ${error}`);
    }
  }

  /**
   * Accept a suggestion and create a real alert rule
   */
  static async acceptSuggestion(
    projectId: string,
    userId: string,
    data: { name: string; description?: string; condition: any; notifyChannels?: string[] }
  ) {
    try {
      const rule = new AlertRuleModel({
        projectId,
        name: data.name,
        description: data.description || "Auto-suggested alert rule",
        condition: data.condition,
        isActive: true,
        notifyChannels: data.notifyChannels || ["email"],
        createdBy: userId,
      });

      const saved = await rule.save();
      return saved;
    } catch (error) {
      throw new AISuggestionServiceError(`Failed to accept suggestion: ${error}`);
    }
  }
}
