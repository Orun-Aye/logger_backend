"use strict";
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
exports.DashboardService = exports.DashboardOperationError = exports.DashboardValidationError = void 0;
const mongoose_1 = require("mongoose");
const log_model_1 = require("../models/log.model");
const project_model_1 = require("../models/project.model");
// Custom error classes following ProjectService pattern
class DashboardValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "DashboardValidationError";
    }
}
exports.DashboardValidationError = DashboardValidationError;
class DashboardOperationError extends Error {
    constructor(message, context) {
        super(message);
        this.name = "DashboardOperationError";
        this.context = context;
    }
}
exports.DashboardOperationError = DashboardOperationError;
class DashboardService {
    // Validation helper - following ProjectService pattern
    static validateObjectId(id) {
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            throw new DashboardValidationError(`Invalid user ID format: ${id}`);
        }
    }
    // Get user's accessible project IDs - centralized logic
    static getUserAccessibleProjects(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.validateObjectId(userId);
                const userObjectId = new mongoose_1.Types.ObjectId(userId);
                const userProjects = yield project_model_1.ProjectModel.find({
                    $or: [
                        { ownerId: userObjectId },
                        { "teamMembers.user": userObjectId }
                    ],
                    isActive: true
                })
                    .select("_id")
                    .lean();
                return userProjects.map(p => p._id.toString());
            }
            catch (error) {
                throw new DashboardOperationError(`Failed to get user accessible projects: ${error}`, { userId, originalError: error });
            }
        });
    }
    // Build base query with user access validation
    static buildUserScopedQuery(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { userId, timeRange, environment, logLevels, eventTypes, services, specificProjectIds } = filters;
                // Get all projects user has access to
                const accessibleProjectIds = yield this.getUserAccessibleProjects(userId);
                if (accessibleProjectIds.length === 0) {
                    throw new DashboardValidationError("User has no accessible projects");
                }
                // If specific project IDs are requested, validate they're within user's access
                let finalProjectIds = accessibleProjectIds;
                if (specificProjectIds === null || specificProjectIds === void 0 ? void 0 : specificProjectIds.length) {
                    const invalidProjectIds = specificProjectIds.filter(id => !accessibleProjectIds.includes(id));
                    if (invalidProjectIds.length > 0) {
                        throw new DashboardValidationError(`User does not have access to projects: ${invalidProjectIds.join(", ")}`);
                    }
                    finalProjectIds = specificProjectIds;
                }
                // Build base query
                const baseQuery = {
                    createdAt: { $gte: timeRange.start, $lte: timeRange.end },
                    projectId: { $in: finalProjectIds }
                };
                if (environment === null || environment === void 0 ? void 0 : environment.length) {
                    baseQuery.environment = { $in: environment };
                }
                if (logLevels === null || logLevels === void 0 ? void 0 : logLevels.length) {
                    baseQuery.level = { $in: logLevels };
                }
                if (eventTypes === null || eventTypes === void 0 ? void 0 : eventTypes.length) {
                    baseQuery.eventType = { $in: eventTypes };
                }
                if (services === null || services === void 0 ? void 0 : services.length) {
                    baseQuery.service = { $in: services };
                }
                return {
                    baseQuery,
                    accessibleProjectIds: finalProjectIds
                };
            }
            catch (error) {
                if (error instanceof DashboardValidationError) {
                    throw error;
                }
                throw new DashboardOperationError(`Failed to build user scoped query: ${error}`, { filters, originalError: error });
            }
        });
    }
    /**
     * Get comprehensive dashboard metrics for a specific user
     * All data is automatically scoped to projects the user has access to
     */
    static getDashboardMetrics(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { baseQuery, accessibleProjectIds } = yield this.buildUserScopedQuery(filters);
                // Execute all metrics queries in parallel for better performance
                const [totalLogs, totalProjects, errorStats, responseTimeStats, logsOverTime, topErrors, browserStats, networkStats, projectHealth, pageLoadStats] = yield Promise.all([
                    this.getTotalLogs(baseQuery),
                    accessibleProjectIds.length, // We already know the count
                    this.getErrorStatistics(baseQuery),
                    this.getResponseTimeStatistics(baseQuery),
                    this.getLogsOverTime(baseQuery, filters.timeRange),
                    this.getTopErrors(baseQuery),
                    this.getBrowserStatistics(baseQuery),
                    this.getNetworkStatistics(baseQuery),
                    this.getProjectHealth(accessibleProjectIds, filters.timeRange),
                    this.getPageLoadStatistics(baseQuery)
                ]);
                const averageLogsPerProject = totalProjects > 0 ? totalLogs / totalProjects : 0;
                const averageErrorRate = totalLogs > 0 ? (errorStats.totalErrors / totalLogs) * 100 : 0;
                return {
                    totalLogs,
                    totalProjects,
                    totalErrors: errorStats.totalErrors,
                    totalWarnings: errorStats.totalWarnings,
                    averageLogsPerProject,
                    averageResponseTime: responseTimeStats.average,
                    averageErrorRate,
                    p95ResponseTime: responseTimeStats.p95,
                    p99ResponseTime: responseTimeStats.p99,
                    slowestEndpoints: responseTimeStats.slowestEndpoints,
                    errorsByType: errorStats.errorsByType,
                    topErrors,
                    logsOverTime,
                    pageLoadTimes: pageLoadStats,
                    browserStats,
                    networkStats,
                    projectHealth,
                    metadata: {
                        userId: filters.userId,
                        accessibleProjects: accessibleProjectIds.length,
                        timeRange: filters.timeRange,
                        filters,
                        generatedAt: new Date()
                    }
                };
            }
            catch (error) {
                if (error instanceof DashboardValidationError) {
                    throw error;
                }
                throw new DashboardOperationError(`Failed to get dashboard metrics: ${error}`, { filters, originalError: error });
            }
        });
    }
    /**
     * Get real-time metrics for live dashboard - user scoped
     */
    static getRealTimeMetrics(userId, specificProjectIds) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.validateObjectId(userId);
                const now = new Date();
                const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
                const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
                // Get user accessible projects
                const accessibleProjectIds = yield this.getUserAccessibleProjects(userId);
                if (accessibleProjectIds.length === 0) {
                    throw new DashboardValidationError("User has no accessible projects");
                }
                // Validate specific project IDs if provided
                let finalProjectIds = accessibleProjectIds;
                if (specificProjectIds === null || specificProjectIds === void 0 ? void 0 : specificProjectIds.length) {
                    const invalidProjectIds = specificProjectIds.filter(id => !accessibleProjectIds.includes(id));
                    if (invalidProjectIds.length > 0) {
                        throw new DashboardValidationError(`User does not have access to projects: ${invalidProjectIds.join(", ")}`);
                    }
                    finalProjectIds = specificProjectIds;
                }
                const baseQuery = {
                    projectId: { $in: finalProjectIds }
                };
                const [currentRPS, errorRate, recentErrors, activeUsers] = yield Promise.all([
                    this.getCurrentRPS(baseQuery, oneMinuteAgo),
                    this.getCurrentErrorRate(baseQuery, fiveMinutesAgo),
                    this.getRecentErrors(baseQuery, fiveMinutesAgo),
                    this.getActiveUsers(baseQuery, fiveMinutesAgo)
                ]);
                return {
                    currentRPS,
                    currentErrorRate: errorRate,
                    activeUsers,
                    recentErrors,
                    metadata: {
                        userId,
                        accessibleProjects: finalProjectIds.length,
                        generatedAt: new Date()
                    }
                };
            }
            catch (error) {
                if (error instanceof DashboardValidationError) {
                    throw error;
                }
                throw new DashboardOperationError(`Failed to get real-time metrics: ${error}`, { userId, specificProjectIds, originalError: error });
            }
        });
    }
    // Private helper methods remain largely the same but with better error handling
    static getTotalLogs(query) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield log_model_1.LogModel.countDocuments(query);
            }
            catch (error) {
                throw new DashboardOperationError(`Failed to count total logs: ${error}`);
            }
        });
    }
    static getErrorStatistics(baseQuery) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const [errorResults] = yield log_model_1.LogModel.aggregate([
                    { $match: baseQuery },
                    {
                        $group: {
                            _id: null,
                            totalErrors: {
                                $sum: { $cond: [{ $in: ['$level', ['error', 'fatal']] }, 1, 0] }
                            },
                            totalWarnings: {
                                $sum: { $cond: [{ $eq: ['$level', 'warn'] }, 1, 0] }
                            }
                        }
                    }
                ]);
                // Get errors by type
                const errorsByType = yield log_model_1.LogModel.aggregate([
                    {
                        $match: Object.assign(Object.assign({}, baseQuery), { level: { $in: ['error', 'fatal'] }, 'error.name': { $exists: true } })
                    },
                    {
                        $group: {
                            _id: '$error.name',
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { count: -1 } },
                    { $limit: 10 }
                ]);
                const totalErrors = (errorResults === null || errorResults === void 0 ? void 0 : errorResults.totalErrors) || 0;
                const errorTypeResults = errorsByType.map(item => ({
                    type: item._id || 'Unknown',
                    count: item.count,
                    percentage: totalErrors > 0 ? Math.round((item.count / totalErrors) * 10000) / 100 : 0
                }));
                return {
                    totalErrors: totalErrors,
                    totalWarnings: (errorResults === null || errorResults === void 0 ? void 0 : errorResults.totalWarnings) || 0,
                    errorsByType: errorTypeResults
                };
            }
            catch (error) {
                throw new DashboardOperationError(`Failed to get error statistics: ${error}`);
            }
        });
    }
    static getResponseTimeStatistics(baseQuery) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Get response times from network events and performance events
                const responseTimeResults = yield log_model_1.LogModel.aggregate([
                    {
                        $match: Object.assign(Object.assign({}, baseQuery), { $or: [
                                { eventType: 'network', 'data.network.duration': { $exists: true } },
                                { eventType: 'performance', 'data.performance.duration': { $exists: true } }
                            ] })
                    },
                    {
                        $addFields: {
                            duration: {
                                $cond: {
                                    if: { $eq: ['$eventType', 'network'] },
                                    then: '$data.network.duration',
                                    else: '$data.performance.duration'
                                }
                            },
                            url: {
                                $cond: {
                                    if: { $eq: ['$eventType', 'network'] },
                                    then: '$data.network.url',
                                    else: '$url'
                                }
                            }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            avgDuration: { $avg: '$duration' },
                            durations: { $push: '$duration' },
                            urlStats: {
                                $push: {
                                    url: '$url',
                                    duration: '$duration'
                                }
                            }
                        }
                    }
                ]);
                if (!responseTimeResults.length) {
                    return {
                        average: 0,
                        p95: 0,
                        p99: 0,
                        slowestEndpoints: []
                    };
                }
                const result = responseTimeResults[0];
                const durations = result.durations.sort((a, b) => a - b);
                const p95Index = Math.floor(durations.length * 0.95);
                const p99Index = Math.floor(durations.length * 0.99);
                // Get slowest endpoints
                const urlGroups = new Map();
                result.urlStats.forEach((item) => {
                    if (!item.url)
                        return;
                    const existing = urlGroups.get(item.url) || { totalTime: 0, count: 0 };
                    existing.totalTime += item.duration;
                    existing.count += 1;
                    urlGroups.set(item.url, existing);
                });
                const slowestEndpoints = Array.from(urlGroups.entries())
                    .map(([url, stats]) => ({
                    url,
                    averageTime: Math.round(stats.totalTime / stats.count),
                    requestCount: stats.count
                }))
                    .sort((a, b) => b.averageTime - a.averageTime)
                    .slice(0, 10);
                return {
                    average: Math.round(result.avgDuration || 0),
                    p95: durations[p95Index] || 0,
                    p99: durations[p99Index] || 0,
                    slowestEndpoints
                };
            }
            catch (error) {
                throw new DashboardOperationError(`Failed to get response time statistics: ${error}`);
            }
        });
    }
    static getLogsOverTime(baseQuery, timeRange) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const interval = this.getTimeInterval(timeRange);
                const results = yield log_model_1.LogModel.aggregate([
                    { $match: baseQuery },
                    {
                        $group: {
                            _id: {
                                $dateTrunc: {
                                    date: '$createdAt',
                                    unit: interval
                                }
                            },
                            total: { $sum: 1 },
                            errors: {
                                $sum: { $cond: [{ $in: ['$level', ['error', 'fatal']] }, 1, 0] }
                            },
                            warnings: {
                                $sum: { $cond: [{ $eq: ['$level', 'warn'] }, 1, 0] }
                            },
                            info: {
                                $sum: { $cond: [{ $eq: ['$level', 'info'] }, 1, 0] }
                            }
                        }
                    },
                    { $sort: { '_id': 1 } }
                ]);
                return results.map(item => ({
                    timestamp: item._id,
                    total: item.total,
                    errors: item.errors,
                    warnings: item.warnings,
                    info: item.info
                }));
            }
            catch (error) {
                throw new DashboardOperationError(`Failed to get logs over time: ${error}`);
            }
        });
    }
    static getTopErrors(baseQuery) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield log_model_1.LogModel.aggregate([
                    {
                        $match: Object.assign(Object.assign({}, baseQuery), { level: { $in: ['error', 'fatal'] } })
                    },
                    {
                        $group: {
                            _id: '$message',
                            count: { $sum: 1 },
                            lastSeen: { $max: '$createdAt' },
                            affectedUsers: { $addToSet: '$context.userId' }
                        }
                    },
                    {
                        $project: {
                            message: '$_id',
                            count: 1,
                            lastSeen: 1,
                            affectedUsers: { $size: '$affectedUsers' },
                            _id: 0
                        }
                    },
                    { $sort: { count: -1 } },
                    { $limit: 10 }
                ]);
            }
            catch (error) {
                throw new DashboardOperationError(`Failed to get top errors: ${error}`);
            }
        });
    }
    static getBrowserStatistics(baseQuery) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield log_model_1.LogModel.aggregate([
                    {
                        $match: Object.assign(Object.assign({}, baseQuery), { userAgent: { $exists: true, $ne: null } })
                    },
                    {
                        $addFields: {
                            browserInfo: {
                                $regexFind: {
                                    input: '$userAgent',
                                    regex: /(Chrome|Firefox|Safari|Edge|Opera)\/(\d+)/
                                }
                            }
                        }
                    },
                    {
                        $match: {
                            browserInfo: { $ne: null }
                        }
                    },
                    {
                        $group: {
                            _id: {
                                browser: { $arrayElemAt: ['$browserInfo.captures', 0] },
                                version: { $arrayElemAt: ['$browserInfo.captures', 1] }
                            },
                            count: { $sum: 1 },
                            errors: {
                                $sum: { $cond: [{ $in: ['$level', ['error', 'fatal']] }, 1, 0] }
                            }
                        }
                    },
                    {
                        $project: {
                            browser: '$_id.browser',
                            version: '$_id.version',
                            count: 1,
                            errorRate: {
                                $round: [{
                                        $cond: {
                                            if: { $gt: ['$count', 0] },
                                            then: { $multiply: [{ $divide: ['$errors', '$count'] }, 100] },
                                            else: 0
                                        }
                                    }, 2]
                            },
                            _id: 0
                        }
                    },
                    { $sort: { count: -1 } },
                    { $limit: 10 }
                ]);
            }
            catch (error) {
                throw new DashboardOperationError(`Failed to get browser statistics: ${error}`);
            }
        });
    }
    static getNetworkStatistics(baseQuery) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const networkResults = yield log_model_1.LogModel.aggregate([
                    {
                        $match: Object.assign(Object.assign({}, baseQuery), { eventType: 'network', 'data.network': { $exists: true } })
                    },
                    {
                        $group: {
                            _id: null,
                            totalRequests: { $sum: 1 },
                            averageRequestTime: { $avg: '$data.network.duration' },
                            failedRequests: {
                                $sum: {
                                    $cond: [
                                        {
                                            $or: [
                                                { $gte: ['$data.network.status', 400] },
                                                { $eq: ['$data.network.status', null] }
                                            ]
                                        },
                                        1,
                                        0
                                    ]
                                }
                            },
                            slowRequests: {
                                $sum: {
                                    $cond: [{ $gte: ['$data.network.duration', 3000] }, 1, 0]
                                }
                            }
                        }
                    }
                ]);
                const result = networkResults[0] || {};
                return {
                    averageRequestTime: Math.round(result.averageRequestTime || 0),
                    failureRate: result.totalRequests > 0 ?
                        Math.round((result.failedRequests / result.totalRequests) * 10000) / 100 : 0,
                    slowRequests: result.slowRequests || 0,
                    totalRequests: result.totalRequests || 0
                };
            }
            catch (error) {
                throw new DashboardOperationError(`Failed to get network statistics: ${error}`);
            }
        });
    }
    static getProjectHealth(projectIds, timeRange) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const projects = yield project_model_1.ProjectModel.find({
                    _id: { $in: projectIds.map(id => new mongoose_1.Types.ObjectId(id)) },
                    isActive: true
                }).lean();
                const healthPromises = projects.map((project) => __awaiter(this, void 0, void 0, function* () {
                    const logQuery = { projectId: project._id.toString() };
                    if (timeRange) {
                        logQuery.createdAt = { $gte: timeRange.start, $lte: timeRange.end };
                    }
                    const [logStats] = yield log_model_1.LogModel.aggregate([
                        { $match: logQuery },
                        {
                            $group: {
                                _id: null,
                                totalLogs: { $sum: 1 },
                                errorCount: {
                                    $sum: { $cond: [{ $in: ['$level', ['error', 'fatal']] }, 1, 0] }
                                },
                                lastActivity: { $max: '$createdAt' }
                            }
                        }
                    ]);
                    const totalLogs = (logStats === null || logStats === void 0 ? void 0 : logStats.totalLogs) || 0;
                    const errorCount = (logStats === null || logStats === void 0 ? void 0 : logStats.errorCount) || 0;
                    const errorRate = totalLogs > 0 ? Math.round((errorCount / totalLogs) * 10000) / 100 : 0;
                    // Calculate health score (0-100)
                    let healthScore = 100;
                    if (errorRate > 10)
                        healthScore -= 40;
                    else if (errorRate > 5)
                        healthScore -= 20;
                    else if (errorRate > 1)
                        healthScore -= 10;
                    if (!(logStats === null || logStats === void 0 ? void 0 : logStats.lastActivity))
                        healthScore -= 30; // No recent activity
                    else {
                        const daysSinceActivity = (Date.now() - logStats.lastActivity.getTime()) / (1000 * 60 * 60 * 24);
                        if (daysSinceActivity > 7)
                            healthScore -= 20;
                        else if (daysSinceActivity > 3)
                            healthScore -= 10;
                    }
                    return {
                        projectId: project._id.toString(),
                        projectName: project.name,
                        errorRate,
                        logVolume: totalLogs,
                        lastActivity: (logStats === null || logStats === void 0 ? void 0 : logStats.lastActivity) || new Date(0),
                        healthScore: Math.max(0, healthScore)
                    };
                }));
                return yield Promise.all(healthPromises);
            }
            catch (error) {
                throw new DashboardOperationError(`Failed to get project health: ${error}`);
            }
        });
    }
    static getPageLoadStatistics(baseQuery) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield log_model_1.LogModel.aggregate([
                    {
                        $match: Object.assign(Object.assign({}, baseQuery), { eventType: 'performance', 'data.performance.type': 'navigation' })
                    },
                    {
                        $group: {
                            _id: '$url',
                            averageTime: { $avg: '$data.performance.duration' },
                            durations: { $push: '$data.performance.duration' },
                            count: { $sum: 1 }
                        }
                    },
                    {
                        $addFields: {
                            p95Time: {
                                $let: {
                                    vars: {
                                        sortedDurations: {
                                            $sortArray: { input: '$durations', sortBy: 1 }
                                        }
                                    },
                                    in: {
                                        $arrayElemAt: [
                                            '$$sortedDurations',
                                            { $floor: { $multiply: [{ $size: '$$sortedDurations' }, 0.95] } }
                                        ]
                                    }
                                }
                            }
                        }
                    },
                    {
                        $project: {
                            url: '$_id',
                            averageTime: { $round: ['$averageTime', 0] },
                            p95Time: { $round: ['$p95Time', 0] },
                            count: 1,
                            _id: 0
                        }
                    },
                    { $sort: { averageTime: -1 } },
                    { $limit: 20 }
                ]);
            }
            catch (error) {
                throw new DashboardOperationError(`Failed to get page load statistics: ${error}`);
            }
        });
    }
    // Real-time metrics helpers
    static getCurrentRPS(baseQuery, since) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const count = yield log_model_1.LogModel.countDocuments(Object.assign(Object.assign({}, baseQuery), { createdAt: { $gte: since } }));
                const seconds = (Date.now() - since.getTime()) / 1000;
                return seconds > 0 ? Math.round((count / seconds) * 100) / 100 : 0;
            }
            catch (error) {
                throw new DashboardOperationError(`Failed to get current RPS: ${error}`);
            }
        });
    }
    static getCurrentErrorRate(baseQuery, since) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const [stats] = yield log_model_1.LogModel.aggregate([
                    {
                        $match: Object.assign(Object.assign({}, baseQuery), { createdAt: { $gte: since } })
                    },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: 1 },
                            errors: {
                                $sum: { $cond: [{ $in: ['$level', ['error', 'fatal']] }, 1, 0] }
                            }
                        }
                    }
                ]);
                if (!stats || stats.total === 0)
                    return 0;
                return Math.round((stats.errors / stats.total) * 10000) / 100;
            }
            catch (error) {
                throw new DashboardOperationError(`Failed to get current error rate: ${error}`);
            }
        });
    }
    static getRecentErrors(baseQuery, since) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const errors = yield log_model_1.LogModel.find(Object.assign(Object.assign({}, baseQuery), { level: { $in: ['error', 'fatal'] }, createdAt: { $gte: since } }))
                    .sort({ createdAt: -1 })
                    .limit(10)
                    .select('message createdAt projectId level')
                    .lean();
                return errors.map(error => ({
                    message: error.message,
                    timestamp: error.createdAt,
                    projectId: error.projectId,
                    severity: error.level
                }));
            }
            catch (error) {
                throw new DashboardOperationError(`Failed to get recent errors: ${error}`);
            }
        });
    }
    static getActiveUsers(baseQuery, since) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield log_model_1.LogModel.distinct('context.userId', Object.assign(Object.assign({}, baseQuery), { 'context.userId': { $exists: true, $ne: null }, createdAt: { $gte: since } }));
                return result.length;
            }
            catch (error) {
                throw new DashboardOperationError(`Failed to get active users: ${error}`);
            }
        });
    }
    static getTimeInterval(timeRange) {
        const diffInHours = (timeRange.end.getTime() - timeRange.start.getTime()) / (1000 * 60 * 60);
        if (diffInHours <= 24)
            return 'hour';
        if (diffInHours <= 24 * 7)
            return 'day';
        return 'day';
    }
    /**
     * Export dashboard data for reports - user scoped
     */
    static exportDashboardData(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const metrics = yield this.getDashboardMetrics(filters);
                return {
                    exportedAt: new Date().toISOString(),
                    userId: filters.userId,
                    filters,
                    metrics,
                    summary: {
                        healthStatus: this.calculateOverallHealth(metrics),
                        keyInsights: this.generateKeyInsights(metrics)
                    }
                };
            }
            catch (error) {
                throw new DashboardOperationError(`Failed to export dashboard data: ${error}`, { filters, originalError: error });
            }
        });
    }
    static calculateOverallHealth(metrics) {
        if (metrics.averageErrorRate > 10 || metrics.averageResponseTime > 3000) {
            return 'critical';
        }
        if (metrics.averageErrorRate > 5 || metrics.averageResponseTime > 1000) {
            return 'warning';
        }
        return 'healthy';
    }
    static generateKeyInsights(metrics) {
        const insights = [];
        if (metrics.averageErrorRate > 5) {
            insights.push(`High error rate detected: ${metrics.averageErrorRate.toFixed(2)}%`);
        }
        if (metrics.averageResponseTime > 2000) {
            insights.push(`Slow average response time: ${metrics.averageResponseTime.toFixed(0)}ms`);
        }
        if (metrics.topErrors.length > 0) {
            insights.push(`Most frequent error: "${metrics.topErrors[0].message}" (${metrics.topErrors[0].count} occurrences)`);
        }
        if (metrics.slowestEndpoints.length > 0) {
            insights.push(`Slowest endpoint: ${metrics.slowestEndpoints[0].url} (${metrics.slowestEndpoints[0].averageTime.toFixed(0)}ms average)`);
        }
        // Project health insights
        const unhealthyProjects = metrics.projectHealth.filter(p => p.healthScore < 70);
        if (unhealthyProjects.length > 0) {
            insights.push(`${unhealthyProjects.length} project(s) need attention`);
        }
        const inactiveProjects = metrics.projectHealth.filter(p => {
            const daysSinceActivity = (Date.now() - p.lastActivity.getTime()) / (1000 * 60 * 60 * 24);
            return daysSinceActivity > 7;
        });
        if (inactiveProjects.length > 0) {
            insights.push(`${inactiveProjects.length} project(s) haven't logged data in over a week`);
        }
        return insights;
    }
    /**
     * Get user's project list with basic health info - useful for project selection UI
     */
    static getUserProjectList(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.validateObjectId(userId);
                const userObjectId = new mongoose_1.Types.ObjectId(userId);
                const projects = yield project_model_1.ProjectModel.find({
                    $or: [
                        { ownerId: userObjectId },
                        { "teamMembers.user": userObjectId }
                    ]
                })
                    .populate('teamMembers.user', 'name')
                    .lean();
                // Get 24h error rates for all projects
                const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
                const projectMetrics = yield Promise.all(projects.map((project) => __awaiter(this, void 0, void 0, function* () {
                    var _a;
                    const [stats] = yield log_model_1.LogModel.aggregate([
                        {
                            $match: {
                                projectId: project._id.toString(),
                                createdAt: { $gte: last24h }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                totalLogs: { $sum: 1 },
                                errorLogs: {
                                    $sum: { $cond: [{ $in: ['$level', ['error', 'fatal']] }, 1, 0] }
                                },
                                lastActivity: { $max: '$createdAt' }
                            }
                        }
                    ]);
                    // Determine user's role in this project
                    let role = 'viewer';
                    if (((_a = project.ownerId) === null || _a === void 0 ? void 0 : _a.toString()) === userId) {
                        role = 'admin';
                    }
                    else {
                        const teamMember = project.teamMembers.find((member) => member.user._id.toString() === userId);
                        if (teamMember) {
                            role = teamMember.role;
                        }
                    }
                    const totalLogs = (stats === null || stats === void 0 ? void 0 : stats.totalLogs) || 0;
                    const errorLogs = (stats === null || stats === void 0 ? void 0 : stats.errorLogs) || 0;
                    const errorRate24h = totalLogs > 0 ? (errorLogs / totalLogs) * 100 : 0;
                    return {
                        projectId: project._id.toString(),
                        projectName: project.name,
                        isActive: project.isActive,
                        logCount: project.logCount || 0,
                        lastActivity: (stats === null || stats === void 0 ? void 0 : stats.lastActivity) || project.lastIngestedAt || null,
                        errorRate24h: Math.round(errorRate24h * 100) / 100,
                        role
                    };
                })));
                return projectMetrics.sort((a, b) => {
                    // Sort by: active first, then by recent activity, then by name
                    if (a.isActive !== b.isActive)
                        return a.isActive ? -1 : 1;
                    const aActivity = a.lastActivity ? a.lastActivity.getTime() : 0;
                    const bActivity = b.lastActivity ? b.lastActivity.getTime() : 0;
                    if (aActivity !== bActivity)
                        return bActivity - aActivity;
                    return a.projectName.localeCompare(b.projectName);
                });
            }
            catch (error) {
                if (error instanceof DashboardValidationError) {
                    throw error;
                }
                throw new DashboardOperationError(`Failed to get user project list: ${error}`, { userId, originalError: error });
            }
        });
    }
    /**
     * Health check for dashboard service
     */
    static healthCheck() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const startTime = Date.now();
                const lastHour = new Date(Date.now() - 60 * 60 * 1000);
                const [totalActiveProjects, totalLogsLastHour] = yield Promise.all([
                    project_model_1.ProjectModel.countDocuments({ isActive: true }),
                    log_model_1.LogModel.countDocuments({ createdAt: { $gte: lastHour } })
                ]);
                const queryTime = Date.now() - startTime;
                return {
                    status: 'healthy',
                    metrics: {
                        totalActiveProjects,
                        totalLogsLastHour,
                        averageQueryTime: queryTime
                    }
                };
            }
            catch (error) {
                return {
                    status: 'unhealthy',
                    error: error instanceof Error ? error.message : String(error)
                };
            }
        });
    }
    /**
     * Get dashboard metrics for multiple users (admin function)
     * Useful for organization-level dashboards
     */
    static getMultiUserMetrics(userIds, filters) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                // Validate all user IDs
                userIds.forEach(userId => this.validateObjectId(userId));
                // Get all accessible projects for all users
                const allUserProjects = new Map();
                const allAccessibleProjectIds = new Set();
                yield Promise.all(userIds.map((userId) => __awaiter(this, void 0, void 0, function* () {
                    const projectIds = yield this.getUserAccessibleProjects(userId);
                    allUserProjects.set(userId, projectIds);
                    projectIds.forEach(id => allAccessibleProjectIds.add(id));
                })));
                // Build combined base query
                const baseQuery = {
                    createdAt: { $gte: filters.timeRange.start, $lte: filters.timeRange.end },
                    projectId: { $in: Array.from(allAccessibleProjectIds) }
                };
                if ((_a = filters.environment) === null || _a === void 0 ? void 0 : _a.length) {
                    baseQuery.environment = { $in: filters.environment };
                }
                if ((_b = filters.logLevels) === null || _b === void 0 ? void 0 : _b.length) {
                    baseQuery.level = { $in: filters.logLevels };
                }
                // Get combined metrics (reusing existing methods)
                const [totalLogs, errorStats, responseTimeStats, logsOverTime, topErrors, browserStats, networkStats] = yield Promise.all([
                    this.getTotalLogs(baseQuery),
                    this.getErrorStatistics(baseQuery),
                    this.getResponseTimeStatistics(baseQuery),
                    this.getLogsOverTime(baseQuery, filters.timeRange),
                    this.getTopErrors(baseQuery),
                    this.getBrowserStatistics(baseQuery),
                    this.getNetworkStatistics(baseQuery)
                ]);
                // Get user breakdown
                const userBreakdown = yield Promise.all(userIds.map((userId) => __awaiter(this, void 0, void 0, function* () {
                    var _a, _b;
                    const userProjectIds = allUserProjects.get(userId) || [];
                    if (userProjectIds.length === 0) {
                        return {
                            userId,
                            accessibleProjects: 0,
                            totalLogs: 0,
                            errorRate: 0,
                            topProject: 'None'
                        };
                    }
                    const userQuery = Object.assign(Object.assign({}, baseQuery), { projectId: { $in: userProjectIds } });
                    const [userStats, topProject] = yield Promise.all([
                        log_model_1.LogModel.aggregate([
                            { $match: userQuery },
                            {
                                $group: {
                                    _id: null,
                                    totalLogs: { $sum: 1 },
                                    errors: { $sum: { $cond: [{ $in: ['$level', ['error', 'fatal']] }, 1, 0] } }
                                }
                            }
                        ]),
                        log_model_1.LogModel.aggregate([
                            { $match: userQuery },
                            { $group: { _id: '$projectId', count: { $sum: 1 } } },
                            { $sort: { count: -1 } },
                            { $limit: 1 },
                            {
                                $lookup: {
                                    from: 'projects',
                                    localField: '_id',
                                    foreignField: '_id',
                                    as: 'project'
                                }
                            },
                            { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } }
                        ])
                    ]);
                    const stats = userStats[0] || { totalLogs: 0, errors: 0 };
                    const errorRate = stats.totalLogs > 0 ? (stats.errors / stats.totalLogs) * 100 : 0;
                    const topProjectName = ((_b = (_a = topProject[0]) === null || _a === void 0 ? void 0 : _a.project) === null || _b === void 0 ? void 0 : _b.name) || 'Unknown';
                    return {
                        userId,
                        accessibleProjects: userProjectIds.length,
                        totalLogs: stats.totalLogs,
                        errorRate: Math.round(errorRate * 100) / 100,
                        topProject: topProjectName
                    };
                })));
                const totalProjects = Array.from(allAccessibleProjectIds).length;
                const averageLogsPerProject = totalProjects > 0 ? totalLogs / totalProjects : 0;
                const averageErrorRate = totalLogs > 0 ? (errorStats.totalErrors / totalLogs) * 100 : 0;
                return {
                    combinedMetrics: {
                        totalLogs,
                        totalProjects,
                        totalErrors: errorStats.totalErrors,
                        totalWarnings: errorStats.totalWarnings,
                        averageLogsPerProject,
                        averageResponseTime: responseTimeStats.average,
                        averageErrorRate,
                        p95ResponseTime: responseTimeStats.p95,
                        p99ResponseTime: responseTimeStats.p99,
                        slowestEndpoints: responseTimeStats.slowestEndpoints,
                        errorsByType: errorStats.errorsByType,
                        topErrors,
                        logsOverTime,
                        pageLoadTimes: [], // Would need separate calculation for multi-user
                        browserStats,
                        networkStats,
                        projectHealth: [] // Would need separate calculation for multi-user
                    },
                    userBreakdown,
                    metadata: {
                        totalUsers: userIds.length,
                        totalUniqueProjects: totalProjects,
                        generatedAt: new Date()
                    }
                };
            }
            catch (error) {
                throw new DashboardOperationError(`Failed to get multi-user metrics: ${error}`, { userIds, filters, originalError: error });
            }
        });
    }
}
exports.DashboardService = DashboardService;
