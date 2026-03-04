"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FunnelService = exports.FunnelServiceError = void 0;
const log_model_1 = require("../models/log.model");
class FunnelServiceError extends Error {
    constructor(message) {
        super(message);
        this.name = "FunnelServiceError";
    }
}
exports.FunnelServiceError = FunnelServiceError;
// Shared time range parser (inline to avoid import issues)
function parseTimeRange(timeRange) {
    const endDate = new Date();
    const startDate = new Date();
    const match = timeRange.match(/^(\d+)([hdwm])$/);
    if (!match) {
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
class FunnelService {
    /**
     * Analyze a conversion funnel through defined steps
     * Tracks how many sessions complete each sequential step
     */
    static async analyzeFunnel(projectId, steps, options = {}) {
        try {
            const { startDate, endDate } = parseTimeRange(options.timeRange || "7d");
            const matchStage = {
                projectId,
                createdAt: { $gte: startDate, $lte: endDate },
                sessionId: { $exists: true, $ne: null },
            };
            if (options.environment) {
                matchStage.environment = options.environment;
            }
            // Get all sessions with their events ordered by time
            const sessions = await log_model_1.LogModel.aggregate([
                { $match: matchStage },
                { $sort: { sessionId: 1, createdAt: 1 } },
                {
                    $group: {
                        _id: "$sessionId",
                        events: {
                            $push: {
                                eventType: "$eventType",
                                url: "$url",
                                message: "$message",
                                level: "$level",
                                timestamp: "$createdAt",
                            },
                        },
                    },
                },
            ]);
            const totalSessions = sessions.length;
            const stepResults = [];
            for (let i = 0; i < steps.length; i++) {
                const step = steps[i];
                let matchCount = 0;
                for (const session of sessions) {
                    // Check if this session reached this step (in order after previous steps)
                    const startIdx = i > 0 ? this.findStepIndex(session.events, steps[i - 1], 0) : -1;
                    const searchFrom = i > 0 ? (startIdx >= 0 ? startIdx + 1 : -1) : 0;
                    if (i > 0 && searchFrom < 0)
                        continue; // Previous step not found
                    const found = this.findStepIndex(session.events, step, searchFrom);
                    if (found >= 0)
                        matchCount++;
                }
                const previousCount = i > 0 ? stepResults[i - 1].count : totalSessions;
                const dropoff = previousCount - matchCount;
                const dropoffRate = previousCount > 0 ? (dropoff / previousCount) * 100 : 0;
                const conversionRate = totalSessions > 0 ? (matchCount / totalSessions) * 100 : 0;
                stepResults.push({
                    name: step.name,
                    count: matchCount,
                    dropoff,
                    dropoffRate: Math.round(dropoffRate * 100) / 100,
                    conversionRate: Math.round(conversionRate * 100) / 100,
                });
            }
            const completionRate = totalSessions > 0 && stepResults.length > 0
                ? (stepResults[stepResults.length - 1].count / totalSessions) * 100
                : 0;
            return {
                steps: stepResults,
                totalSessions,
                completionRate: Math.round(completionRate * 100) / 100,
            };
        }
        catch (error) {
            throw new FunnelServiceError(`Failed to analyze funnel: ${error}`);
        }
    }
    /**
     * Find the most common event paths taken by users
     */
    static async getPopularPaths(projectId, options = {}) {
        try {
            const { startDate, endDate } = parseTimeRange(options.timeRange || "7d");
            const limit = options.limit || 10;
            const results = await log_model_1.LogModel.aggregate([
                {
                    $match: {
                        projectId,
                        createdAt: { $gte: startDate, $lte: endDate },
                        sessionId: { $exists: true, $ne: null },
                        eventType: { $in: ["pageview", "interaction"] },
                    },
                },
                { $sort: { sessionId: 1, createdAt: 1 } },
                {
                    $group: {
                        _id: "$sessionId",
                        path: { $push: { $ifNull: ["$url", "$message"] } },
                    },
                },
                {
                    $project: {
                        pathKey: {
                            $reduce: {
                                input: { $slice: ["$path", 5] }, // First 5 steps
                                initialValue: "",
                                in: { $concat: ["$$value", { $cond: [{ $eq: ["$$value", ""] }, "", " → "] }, { $ifNull: ["$$this", "unknown"] }] },
                            },
                        },
                    },
                },
                { $group: { _id: "$pathKey", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: limit },
                { $project: { _id: 0, path: "$_id", count: 1 } },
            ]);
            return results;
        }
        catch (error) {
            throw new FunnelServiceError(`Failed to get popular paths: ${error}`);
        }
    }
    /**
     * Find the index of a matching event in the events array starting from a given position
     */
    static findStepIndex(events, step, startFrom) {
        for (let i = startFrom; i < events.length; i++) {
            const event = events[i];
            let matches = true;
            if (step.eventType && event.eventType !== step.eventType)
                matches = false;
            if (step.url && event.url && !event.url.includes(step.url))
                matches = false;
            if (step.message && event.message && !event.message.includes(step.message))
                matches = false;
            if (step.level && event.level !== step.level)
                matches = false;
            if (matches)
                return i;
        }
        return -1;
    }
}
exports.FunnelService = FunnelService;
