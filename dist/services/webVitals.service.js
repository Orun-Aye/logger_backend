"use strict";
// src/services/webVitals.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebVitalsService = exports.WebVitalsServiceError = exports.WebVitalsValidationError = void 0;
const log_model_1 = require("../models/log.model");
const mongoose_1 = require("mongoose");
/**
 * Custom error for web vitals validation issues.
 */
class WebVitalsValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "WebVitalsValidationError";
    }
}
exports.WebVitalsValidationError = WebVitalsValidationError;
/**
 * Custom error for web vitals service operation failures.
 */
class WebVitalsServiceError extends Error {
    context;
    constructor(message, context) {
        super(message);
        this.context = context;
        this.name = "WebVitalsServiceError";
    }
}
exports.WebVitalsServiceError = WebVitalsServiceError;
/**
 * Converts a time range string (e.g., "1h", "24h", "7d", "30d") to a Date.
 * Returns a Date representing the start of the time range from now.
 */
function timeRangeToDate(timeRange) {
    const now = new Date();
    const match = timeRange.match(/^(\d+)([hdwm])$/);
    if (!match)
        return new Date(now.getTime() - 24 * 60 * 60 * 1000); // default 24h
    const [, amount, unit] = match;
    const ms = {
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
        w: 7 * 24 * 60 * 60 * 1000,
        m: 30 * 24 * 60 * 60 * 1000,
    };
    return new Date(now.getTime() - parseInt(amount) * ms[unit]);
}
/**
 * Computes the value at a given percentile from a sorted array.
 * Fallback for environments where MongoDB $sortArray is not available.
 */
function percentile(arr, p) {
    if (arr.length === 0)
        return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * p);
    return sorted[Math.min(idx, sorted.length - 1)] ?? 0;
}
/**
 * WebVitalsService - Provides aggregation of web vitals data from logs
 * where eventType === 'web-vital'. Vital data is stored in the log's
 * `data.vital` field with properties: name, value, rating.
 */
class WebVitalsService {
    /**
     * Validates that a string is a valid MongoDB ObjectId.
     */
    static validateObjectId(id) {
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            throw new WebVitalsValidationError(`Invalid ID format: ${id}`);
        }
    }
    /**
     * Retrieves aggregated web vitals metrics for a project.
     * Computes p50, p75, p95 percentiles and good/needs-improvement/poor counts.
     *
     * Uses a two-phase approach: first tries MongoDB $sortArray (5.2+),
     * falls back to in-memory computation if unavailable.
     *
     * @param projectId - The project to query vitals for.
     * @param timeRange - Time range string (e.g., "24h", "7d").
     * @param pageUrl - Optional URL filter to scope vitals to a specific page.
     * @returns An array of vital metric objects.
     */
    static async getWebVitals(projectId, timeRange, pageUrl) {
        try {
            this.validateObjectId(projectId);
            const startDate = timeRangeToDate(timeRange);
            const matchStage = {
                projectId,
                eventType: "web-vital",
                timestamp: { $gte: startDate.toISOString() },
            };
            if (pageUrl) {
                matchStage.url = pageUrl;
            }
            // Try using $sortArray (MongoDB 5.2+) for in-database percentile computation
            try {
                const vitals = await log_model_1.LogModel.aggregate([
                    { $match: matchStage },
                    {
                        $group: {
                            _id: "$data.vital.name",
                            values: { $push: { $toDouble: "$data.vital.value" } },
                            ratings: { $push: "$data.vital.rating" },
                            count: { $sum: 1 },
                        },
                    },
                    {
                        $project: {
                            _id: 0,
                            name: "$_id",
                            count: 1,
                            p50: {
                                $arrayElemAt: [
                                    { $sortArray: { input: "$values", sortBy: 1 } },
                                    { $floor: { $multiply: [{ $size: "$values" }, 0.5] } },
                                ],
                            },
                            p75: {
                                $arrayElemAt: [
                                    { $sortArray: { input: "$values", sortBy: 1 } },
                                    { $floor: { $multiply: [{ $size: "$values" }, 0.75] } },
                                ],
                            },
                            p95: {
                                $arrayElemAt: [
                                    { $sortArray: { input: "$values", sortBy: 1 } },
                                    { $floor: { $multiply: [{ $size: "$values" }, 0.95] } },
                                ],
                            },
                            goodCount: {
                                $size: {
                                    $filter: {
                                        input: "$ratings",
                                        cond: { $eq: ["$$this", "good"] },
                                    },
                                },
                            },
                            needsImprovementCount: {
                                $size: {
                                    $filter: {
                                        input: "$ratings",
                                        cond: { $eq: ["$$this", "needs-improvement"] },
                                    },
                                },
                            },
                            poorCount: {
                                $size: {
                                    $filter: {
                                        input: "$ratings",
                                        cond: { $eq: ["$$this", "poor"] },
                                    },
                                },
                            },
                        },
                    },
                ]);
                return vitals;
            }
            catch (mongoError) {
                // Fallback: $sortArray not available (MongoDB < 5.2)
                // Fetch raw grouped data and compute percentiles in JavaScript
                if (mongoError.codeName === "UnknownExpression" ||
                    mongoError.code === 168 ||
                    mongoError.message?.includes("sortArray")) {
                    return this.getWebVitalsFallback(matchStage);
                }
                throw mongoError;
            }
        }
        catch (error) {
            if (error instanceof WebVitalsValidationError) {
                throw error;
            }
            throw new WebVitalsServiceError(`Failed to fetch web vitals: ${error.message}`, { projectId, timeRange, pageUrl, originalError: error });
        }
    }
    /**
     * Fallback implementation for getWebVitals when $sortArray is not available.
     * Fetches grouped values and computes percentiles in JavaScript.
     */
    static async getWebVitalsFallback(matchStage) {
        const rawData = await log_model_1.LogModel.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: "$data.vital.name",
                    values: { $push: { $toDouble: "$data.vital.value" } },
                    ratings: { $push: "$data.vital.rating" },
                    count: { $sum: 1 },
                },
            },
        ]);
        return rawData.map((vital) => ({
            name: vital._id,
            count: vital.count,
            p50: percentile(vital.values, 0.5),
            p75: percentile(vital.values, 0.75),
            p95: percentile(vital.values, 0.95),
            goodCount: vital.ratings.filter((r) => r === "good").length,
            needsImprovementCount: vital.ratings.filter((r) => r === "needs-improvement").length,
            poorCount: vital.ratings.filter((r) => r === "poor").length,
        }));
    }
    /**
     * Retrieves time-bucketed web vitals history for charting.
     * Groups vitals by time interval and vital name, computing averages.
     *
     * @param projectId - The project to query.
     * @param timeRange - Time range string (e.g., "24h", "7d").
     * @param interval - Bucketing interval: "hour", "day", or "week".
     * @returns An array of time-bucketed vital averages.
     */
    static async getWebVitalsHistory(projectId, timeRange, interval) {
        try {
            this.validateObjectId(projectId);
            const startDate = timeRangeToDate(timeRange);
            const history = await log_model_1.LogModel.aggregate([
                {
                    $match: {
                        projectId,
                        eventType: "web-vital",
                        timestamp: { $gte: startDate.toISOString() },
                    },
                },
                {
                    $addFields: {
                        tsDate: { $toDate: "$timestamp" },
                    },
                },
                {
                    $group: {
                        _id: {
                            bucket: { $dateTrunc: { date: "$tsDate", unit: interval } },
                            vital: "$data.vital.name",
                        },
                        avgValue: { $avg: { $toDouble: "$data.vital.value" } },
                        count: { $sum: 1 },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        bucket: "$_id.bucket",
                        vital: "$_id.vital",
                        avgValue: { $round: ["$avgValue", 2] },
                        count: 1,
                    },
                },
                { $sort: { bucket: 1 } },
            ]);
            return history;
        }
        catch (error) {
            if (error instanceof WebVitalsValidationError) {
                throw error;
            }
            throw new WebVitalsServiceError(`Failed to fetch web vitals history: ${error.message}`, { projectId, timeRange, interval, originalError: error });
        }
    }
    /**
     * Retrieves web vitals aggregated per page URL.
     * Returns a breakdown of vitals for each page, sorted by total samples.
     *
     * @param projectId - The project to query.
     * @param timeRange - Time range string (e.g., "24h", "7d").
     * @returns An array of page-level vital summaries.
     */
    static async getWebVitalsByPage(projectId, timeRange) {
        try {
            this.validateObjectId(projectId);
            const startDate = timeRangeToDate(timeRange);
            const pages = await log_model_1.LogModel.aggregate([
                {
                    $match: {
                        projectId,
                        eventType: "web-vital",
                        timestamp: { $gte: startDate.toISOString() },
                    },
                },
                {
                    $group: {
                        _id: { url: "$url", vital: "$data.vital.name" },
                        avgValue: { $avg: { $toDouble: "$data.vital.value" } },
                        count: { $sum: 1 },
                        ratings: { $push: "$data.vital.rating" },
                    },
                },
                {
                    $group: {
                        _id: "$_id.url",
                        vitals: {
                            $push: {
                                name: "$_id.vital",
                                avgValue: { $round: ["$avgValue", 2] },
                                count: "$count",
                            },
                        },
                        totalSamples: { $sum: "$count" },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        url: "$_id",
                        vitals: 1,
                        totalSamples: 1,
                    },
                },
                { $sort: { totalSamples: -1 } },
                { $limit: 50 },
            ]);
            return pages;
        }
        catch (error) {
            if (error instanceof WebVitalsValidationError) {
                throw error;
            }
            throw new WebVitalsServiceError(`Failed to fetch web vitals by page: ${error.message}`, { projectId, timeRange, originalError: error });
        }
    }
}
exports.WebVitalsService = WebVitalsService;
