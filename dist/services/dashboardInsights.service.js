"use strict";
/**
 * @file src/services/dashboardInsightsService.ts
 * @description Provides business logic for generating dashboard insights from log data,
 * with integrated Redis caching.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardInsightsService = exports.DashboardInsightsServiceError = exports.ProjectNotFoundError = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const redis_1 = require("redis");
const log_model_1 = require("../models/log.model");
const project_model_1 = require("../models/project.model");
const log_service_1 = require("./log.service");
let redisClient;
class ProjectNotFoundError extends Error {
    constructor(projectId) {
        super(`Project with ID ${projectId} not found`);
        this.name = "ProjectNotFoundError";
    }
}
exports.ProjectNotFoundError = ProjectNotFoundError;
class DashboardInsightsServiceError extends Error {
    constructor(message) {
        super(message);
        this.name = "DashboardInsightsServiceError";
    }
}
exports.DashboardInsightsServiceError = DashboardInsightsServiceError;
class DashboardInsightsService {
    static initializeRedis(redisUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            if (redisClient) {
                console.warn("Redis client already initialized.");
                return;
            }
            try {
                redisClient = (0, redis_1.createClient)({ url: redisUrl });
                redisClient.on("error", (err) => console.error("Redis Client Error:", err));
                yield redisClient.connect();
                console.log("Redis client connected successfully!");
            }
            catch (error) {
                console.error("Failed to connect to Redis:", error);
                redisClient = undefined;
                throw new DashboardInsightsServiceError(`Redis connection failed: ${error.message}`);
            }
        });
    }
    static disconnectRedis() {
        return __awaiter(this, void 0, void 0, function* () {
            if (redisClient && redisClient.isReady) {
                yield redisClient.quit();
                console.log("Redis client disconnected.");
                redisClient = undefined;
            }
        });
    }
    static getProjectInsights(projectId_1) {
        return __awaiter(this, arguments, void 0, function* (projectId, options = {}) {
            const internalOptions = {
                range: options.range,
                from: options.from,
                to: options.to,
                severity: options.severity,
                timezone: options.timezone,
            };
            const { range = "7d", from, to, severity, timezone = DashboardInsightsService.defaultTimezone, } = internalOptions;
            const cacheKey = DashboardInsightsService.generateCacheKey(projectId, internalOptions);
            const startTime = process.hrtime.bigint();
            try {
                if (redisClient && redisClient.isReady) {
                    const cachedResult = yield DashboardInsightsService.getCachedInsights(cacheKey);
                    if (cachedResult) {
                        const endTime = process.hrtime.bigint();
                        const queryExecutionTime = Number(endTime - startTime) / 1000000;
                        console.log(`Cache HIT for key: ${cacheKey}`);
                        return Object.assign(Object.assign({}, cachedResult), { meta: Object.assign(Object.assign({}, cachedResult.meta), { cached: true, queryExecutionTime: queryExecutionTime, cacheExpiresAt: new Date(Date.now() + DashboardInsightsService.cacheExpiry * 1000).toISOString() }) });
                    }
                    console.log(`Cache MISS for key: ${cacheKey}`);
                }
                else {
                    console.warn("Redis client not available or not ready, skipping cache lookup.");
                }
                yield DashboardInsightsService.validateProjectAccess(projectId);
                const dateRange = DashboardInsightsService.calculateDateRange(range, from, to, timezone);
                const [summaryData, severityData, timeSeriesData, endpointData, errorAnalysisData, recentActivityData,] = yield Promise.all([
                    DashboardInsightsService.getSummaryData(projectId, dateRange, severity),
                    DashboardInsightsService.getSeverityBreakdown(projectId, dateRange, severity),
                    DashboardInsightsService.getTimeSeriesData(projectId, dateRange, severity, timezone),
                    DashboardInsightsService.getTopEndpoints(projectId, dateRange), // This is the function we're fixing
                    DashboardInsightsService.getErrorAnalysis(projectId, dateRange),
                    DashboardInsightsService.getRecentActivity(projectId),
                ]);
                const insights = {
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
                const queryExecutionTime = Number(endTime - startTime) / 1000000;
                if (redisClient && redisClient.isReady) {
                    yield DashboardInsightsService.cacheInsights(cacheKey, Object.assign(Object.assign({}, insights), { meta: {
                            generatedAt: new Date().toISOString(),
                            queryExecutionTime: queryExecutionTime,
                            cached: false,
                            cacheExpiresAt: new Date(Date.now() + DashboardInsightsService.cacheExpiry * 1000).toISOString()
                        } }));
                }
                return Object.assign(Object.assign({}, insights), { meta: {
                        generatedAt: new Date().toISOString(),
                        queryExecutionTime: queryExecutionTime,
                        cached: false,
                        cacheExpiresAt: (redisClient && redisClient.isReady) ? new Date(Date.now() + DashboardInsightsService.cacheExpiry * 1000).toISOString() : undefined
                    } });
            }
            catch (error) {
                if (error instanceof ProjectNotFoundError || error instanceof DashboardInsightsServiceError) {
                    throw error;
                }
                throw new DashboardInsightsServiceError(`Failed to get dashboard insights: ${error.message || error}`);
            }
        });
    }
    static getSummaryData(projectId, dateRange, severityFilter) {
        return __awaiter(this, void 0, void 0, function* () {
            const matchStage = {
                projectId: new mongoose_1.default.Types.ObjectId(projectId),
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
                                $cond: [{ $in: ["$level", [log_service_1.LogLevel.ERROR, log_service_1.LogLevel.FATAL]] }, 1, 0],
                            },
                        },
                    },
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
            const result = yield log_model_1.LogModel.aggregate(pipeline);
            const data = result[0] || {
                totalLogs: 0,
                totalUniqueEndpoints: 0,
                errorCount: 0,
                errorRate: 0,
            };
            const daysDiff = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) /
                (1000 * 60 * 60 * 24));
            const averageLogsPerDay = daysDiff > 0 ? Math.round(data.totalLogs / daysDiff) : 0;
            return {
                totalLogs: data.totalLogs,
                totalUniqueEndpoints: data.totalUniqueEndpoints,
                averageLogsPerDay,
                errorRate: Math.round(data.errorRate * 10) / 10,
            };
        });
    }
    static getSeverityBreakdown(projectId, dateRange, severityFilter) {
        return __awaiter(this, void 0, void 0, function* () {
            const matchStage = {
                projectId: new mongoose_1.default.Types.ObjectId(projectId),
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
                    },
                },
            ];
            const results = yield log_model_1.LogModel.aggregate(pipeline);
            const severityBreakdown = {
                info: 0, warn: 0, error: 0, critical: 0,
                trace: 0, debug: 0, fatal: 0
            };
            results.forEach((item) => {
                if (Object.values(log_service_1.LogLevel).includes(item._id)) {
                    severityBreakdown[item._id] = item.count;
                }
            });
            return severityBreakdown;
        });
    }
    static getTimeSeriesData(projectId_1, dateRange_1, severityFilter_1) {
        return __awaiter(this, arguments, void 0, function* (projectId, dateRange, severityFilter, timezone = "UTC") {
            const matchStage = {
                projectId: new mongoose_1.default.Types.ObjectId(projectId),
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
                    },
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
                    },
                },
                { $sort: { _id: 1 } },
            ];
            const results = yield log_model_1.LogModel.aggregate(pipeline);
            return results.map((item) => {
                const severityBreakdown = {
                    info: 0, warn: 0, error: 0, critical: 0,
                    trace: 0, debug: 0, fatal: 0
                };
                item.severityBreakdown.forEach((sev) => {
                    if (Object.values(log_service_1.LogLevel).includes(sev.severity)) {
                        severityBreakdown[sev.severity] = sev.count;
                    }
                });
                return {
                    date: item._id,
                    timestamp: new Date(`${item._id}T00:00:00Z`).toISOString(),
                    totalCount: item.totalCount,
                    severityBreakdown,
                };
            });
        });
    }
    /**
     * Get top endpoints data
     */
    static getTopEndpoints(projectId_1, dateRange_1) {
        return __awaiter(this, arguments, void 0, function* (projectId, dateRange, limit = 10) {
            const pipeline = [
                {
                    $match: {
                        projectId: new mongoose_1.default.Types.ObjectId(projectId),
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
                                    { $in: ["$level", [log_service_1.LogLevel.ERROR, log_service_1.LogLevel.FATAL]] },
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
                                            { $in: [{ $type: "$responseTime" }, ["int", "long", "double", "decimal"]] },
                                        ],
                                    },
                                    "$responseTime",
                                    null,
                                ],
                            },
                        },
                    },
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
                { $sort: { totalCount: -1 } },
                { $limit: limit },
            ];
            const results = yield log_model_1.LogModel.aggregate(pipeline);
            return results.map((item) => ({
                path: item.path,
                method: item.method,
                totalCount: item.totalCount,
                errorCount: item.errorCount,
                errorRate: Math.round(item.errorRate * 10) / 10,
                avgResponseTime: item.avgResponseTime
                    ? Math.round(item.avgResponseTime)
                    : null,
            }));
        });
    }
    static getErrorAnalysis(projectId, dateRange) {
        return __awaiter(this, void 0, void 0, function* () {
            const errorMessagesPipeline = [
                {
                    $match: {
                        projectId: new mongoose_1.default.Types.ObjectId(projectId),
                        timestamp: { $gte: dateRange.from, $lte: dateRange.to },
                        level: { $in: [log_service_1.LogLevel.ERROR, log_service_1.LogLevel.FATAL] },
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
                    },
                },
                { $sort: { count: -1 } },
                { $limit: 10 },
            ];
            const periodLength = dateRange.to.getTime() - dateRange.from.getTime();
            const previousPeriodStart = new Date(dateRange.from.getTime() - periodLength);
            const previousPeriodEnd = dateRange.from;
            const [frequentErrors, currentPeriodErrors, previousPeriodErrors] = yield Promise.all([
                log_model_1.LogModel.aggregate(errorMessagesPipeline),
                log_model_1.LogModel.countDocuments({
                    projectId: new mongoose_1.default.Types.ObjectId(projectId),
                    timestamp: { $gte: dateRange.from, $lte: dateRange.to },
                    level: { $in: [log_service_1.LogLevel.ERROR, log_service_1.LogLevel.FATAL] },
                }),
                log_model_1.LogModel.countDocuments({
                    projectId: new mongoose_1.default.Types.ObjectId(projectId),
                    timestamp: { $gte: previousPeriodStart, $lte: previousPeriodEnd },
                    level: { $in: [log_service_1.LogLevel.ERROR, log_service_1.LogLevel.FATAL] },
                }),
            ]);
            const percentageChange = previousPeriodErrors > 0
                ? ((currentPeriodErrors - previousPeriodErrors) /
                    previousPeriodErrors) *
                    100
                : 0;
            return {
                frequentErrorMessages: frequentErrors.map((error) => ({
                    message: error._id,
                    count: error.count,
                    firstSeen: error.firstSeen.toISOString(),
                    lastSeen: error.lastSeen.toISOString(),
                    affectedEndpoints: error.affectedEndpoints.filter((ep) => ep != null),
                })),
                errorTrends: {
                    currentPeriod: currentPeriodErrors,
                    previousPeriod: previousPeriodErrors,
                    percentageChange: Math.round(percentageChange * 10) / 10,
                },
            };
        });
    }
    static getRecentActivity(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const [latestLog, recentCriticalErrors] = yield Promise.all([
                log_model_1.LogModel.findOne({
                    projectId: new mongoose_1.default.Types.ObjectId(projectId),
                })
                    .sort({ timestamp: -1 })
                    .lean(),
                log_model_1.LogModel.aggregate([
                    {
                        $match: {
                            projectId: new mongoose_1.default.Types.ObjectId(projectId),
                            level: log_service_1.LogLevel.FATAL,
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
                        },
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
                        context: (_a = latestLog.data) === null || _a === void 0 ? void 0 : _a.context,
                    }
                    : null,
                recentCriticalErrors: recentCriticalErrors.map((error) => ({
                    timestamp: error.latestTimestamp.toISOString(),
                    message: error._id.message,
                    endpoint: error._id.endpoint,
                    count: error.count,
                })),
            };
        });
    }
    static validateProjectAccess(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!mongoose_1.Types.ObjectId.isValid(projectId)) {
                throw new DashboardInsightsServiceError("Invalid project ID format.");
            }
            const project = yield project_model_1.ProjectModel.findById(projectId);
            if (!project) {
                throw new ProjectNotFoundError(projectId);
            }
            return project;
        });
    }
    static calculateDateRange(range, from, to, timezone) {
        const now = new Date();
        let startDate, endDate;
        if (range === "custom") {
            if (!from || !to) {
                throw new DashboardInsightsServiceError("Custom range requires 'from' and 'to' parameters.");
            }
            startDate = new Date(from);
            endDate = new Date(to);
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                throw new DashboardInsightsServiceError("Invalid date format for 'from' or 'to' parameters.");
            }
        }
        else {
            const durationMap = {
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
    static generateCacheKey(projectId, options) {
        const sortedOptions = Object.keys(options)
            .sort()
            .reduce((obj, key) => {
            const value = options[key];
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
    static getCachedInsights(cacheKey) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!redisClient || !redisClient.isReady) {
                    console.warn("Redis client not ready for cache retrieval.");
                    return null;
                }
                const cached = yield redisClient.get(cacheKey);
                if (cached) {
                    const data = JSON.parse(cached);
                    if (data.timeRange) {
                        data.timeRange.from = new Date(data.timeRange.from);
                        data.timeRange.to = new Date(data.timeRange.to);
                    }
                    return data;
                }
            }
            catch (error) {
                console.warn("Cache retrieval failed:", error.message);
            }
            return null;
        });
    }
    static cacheInsights(cacheKey, insights) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!redisClient || !redisClient.isReady) {
                    console.warn("Redis client not ready for cache storage.");
                    return;
                }
                const insightsToStore = Object.assign(Object.assign({}, insights), { timeRange: Object.assign(Object.assign({}, insights.timeRange), { from: insights.timeRange.from.toISOString(), to: insights.timeRange.to.toISOString() }), recentActivity: insights.recentActivity ? Object.assign(Object.assign({}, insights.recentActivity), { latestLog: insights.recentActivity.latestLog ? Object.assign(Object.assign({}, insights.recentActivity.latestLog), { timestamp: insights.recentActivity.latestLog.timestamp }) : null, recentCriticalErrors: insights.recentActivity.recentCriticalErrors.map(err => (Object.assign(Object.assign({}, err), { timestamp: err.timestamp }))) }) : insights.recentActivity, errorAnalysis: insights.errorAnalysis ? Object.assign(Object.assign({}, insights.errorAnalysis), { frequentErrorMessages: insights.errorAnalysis.frequentErrorMessages.map(msg => (Object.assign(Object.assign({}, msg), { firstSeen: msg.firstSeen, lastSeen: msg.lastSeen }))) }) : insights.errorAnalysis });
                yield redisClient.setEx(cacheKey, DashboardInsightsService.cacheExpiry, JSON.stringify(insightsToStore));
            }
            catch (error) {
                console.warn("Cache storage failed:", error.message);
            }
        });
    }
    static invalidateProjectCache(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!redisClient || !redisClient.isReady) {
                    console.warn("Redis client not ready for cache invalidation.");
                    return;
                }
                const pattern = `dashboard_insights:${projectId}:*`;
                const keys = yield redisClient.keys(pattern);
                if (keys.length > 0) {
                    yield redisClient.del(keys);
                    console.log(`Invalidated ${keys.length} cache entries for project ${projectId}.`);
                }
                else {
                    console.log(`No cache entries found to invalidate for project ${projectId}.`);
                }
            }
            catch (error) {
                console.warn("Cache invalidation failed:", error.message);
            }
        });
    }
}
exports.DashboardInsightsService = DashboardInsightsService;
DashboardInsightsService.cacheExpiry = 300;
DashboardInsightsService.defaultTimezone = "UTC";
