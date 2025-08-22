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
exports.ProjectService = exports.ProjectOperationError = exports.ProjectValidationError = exports.ProjectNotFoundError = void 0;
const project_model_1 = require("../models/project.model");
const uuid_1 = require("uuid");
const mongoose_1 = require("mongoose");
const log_model_1 = require("../models/log.model");
// Custom error classes for better error handling
class ProjectNotFoundError extends Error {
    constructor(id) {
        super(`Project with ID ${id} not found`);
        this.name = "ProjectNotFoundError";
    }
}
exports.ProjectNotFoundError = ProjectNotFoundError;
class ProjectValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "ProjectValidationError";
    }
}
exports.ProjectValidationError = ProjectValidationError;
class ProjectOperationError extends Error {
    constructor(message, context) {
        super(message);
        this.name = "ProjectOperationError";
    }
}
exports.ProjectOperationError = ProjectOperationError;
class ProjectService {
    // Input validation helper
    static validateObjectId(id) {
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            throw new ProjectValidationError(`Invalid project ID format: ${id}`);
        }
    }
    // Validation for create data
    static validateCreateData(data) {
        if (!data.name || data.name.trim().length === 0) {
            throw new ProjectValidationError("Project name is required");
        }
        if (data.name.length > 100) {
            throw new ProjectValidationError("Project name cannot exceed 100 characters");
        }
    }
    static updateLogCount(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const logCount = yield log_model_1.LogModel.countDocuments({ projectId });
                yield project_model_1.ProjectModel.findByIdAndUpdate(projectId, {
                    logCount,
                    lastIngestedAt: new Date(),
                });
                return logCount;
            }
            catch (error) {
                throw new ProjectOperationError(`Failed to update log count: ${error}`);
            }
        });
    }
    static recalculateProjectStats(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const [logCount, lastLog] = yield Promise.all([
                    log_model_1.LogModel.countDocuments({ projectId }),
                    log_model_1.LogModel.findOne({ projectId })
                        .sort({ timestamp: -1 })
                        .select("timestamp")
                        .lean(),
                ]);
                const updateData = { logCount };
                if (lastLog) {
                    updateData.lastIngestedAt = new Date(lastLog.timestamp);
                }
                yield project_model_1.ProjectModel.findByIdAndUpdate(projectId, updateData);
                return { logCount, lastIngestedAt: lastLog === null || lastLog === void 0 ? void 0 : lastLog.timestamp };
            }
            catch (error) {
                throw new ProjectOperationError(`Failed to recalculate project stats: ${error}`);
            }
        });
    }
    static createProject(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.validateCreateData(data);
                // Check for duplicate names
                const existingProject = yield project_model_1.ProjectModel.findOne({
                    name: data.name.trim(),
                });
                if (existingProject) {
                    throw new ProjectValidationError("Project with this name already exists");
                }
                const apiKey = (0, uuid_1.v4)();
                const project = new project_model_1.ProjectModel(Object.assign(Object.assign({}, data), { name: data.name.trim(), ownerId: data.ownerId, teamMembers: [{ user: data.ownerId, role: "admin" }], apiKey, createdAt: new Date(), updatedAt: new Date() }));
                const savedProject = yield project.save();
                // Return only necessary fields
                return {
                    id: savedProject._id,
                    name: savedProject.name,
                    description: savedProject.description,
                    apiKey: savedProject.apiKey,
                    isActive: savedProject.isActive,
                    logCount: savedProject.logCount,
                    createdAt: savedProject.createdAt,
                    updatedAt: savedProject.updatedAt,
                };
            }
            catch (error) {
                if (error instanceof ProjectValidationError) {
                    throw error;
                }
                throw new Error(`Failed to create project: ${error}`);
            }
        });
    }
    static getAllProjects() {
        return __awaiter(this, arguments, void 0, function* (options = {}) {
            try {
                const { page = 1, limit = 10, sortBy = "createdAt", sortOrder = "desc", includeInactive = false, tags, } = options;
                const skip = (page - 1) * limit;
                const sort = {
                    [sortBy]: sortOrder === "desc" ? -1 : 1,
                };
                const filter = {};
                if (!includeInactive) {
                    filter.isActive = true;
                }
                if (tags && tags.length > 0) {
                    filter.tags = { $in: tags };
                }
                const [projects, total] = yield Promise.all([
                    project_model_1.ProjectModel.find(filter)
                        .select("-__v") // Exclude version key
                        .populate("ownerId", "firstName lastName email")
                        .populate("teamMembers.user", "firstName lastName email")
                        .sort(sort)
                        .skip(skip)
                        .limit(limit)
                        .lean(), // Better performance for read-only operations
                    project_model_1.ProjectModel.countDocuments(filter),
                ]);
                return {
                    projects,
                    pagination: {
                        current: page,
                        total: Math.ceil(total / limit),
                        count: projects.length,
                        order: sortOrder,
                        totalRecords: total,
                    },
                };
            }
            catch (error) {
                throw new Error(`Failed to fetch projects: ${error}`);
            }
        });
    }
    static getProjectsByUser(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, options = {}) {
            try {
                const { page = 1, limit = 10, sortBy = "createdAt", sortOrder = "desc", searchBy = "both", includeInactive = false, includeMetrics = true, metricsTimeRange = 168, // 7 days in hours
                 } = options;
                const skip = (page - 1) * limit;
                const sort = {
                    [sortBy]: sortOrder === "desc" ? -1 : 1,
                };
                this.validateObjectId(userId);
                const userObjectId = new mongoose_1.Types.ObjectId(userId);
                let queryCondition = {};
                if (searchBy === "owner") {
                    queryCondition.ownerId = userObjectId;
                }
                else if (searchBy === "teamMember") {
                    queryCondition["teamMembers.user"] = userObjectId;
                }
                else {
                    // 'both'
                    queryCondition.$or = [
                        { ownerId: userObjectId },
                        { "teamMembers.user": userObjectId },
                    ];
                }
                if (!includeInactive) {
                    queryCondition.isActive = true;
                }
                const [projects, total] = yield Promise.all([
                    project_model_1.ProjectModel.find(queryCondition)
                        .select("-__v")
                        .populate("ownerId", "firstName lastName email")
                        .populate("teamMembers.user", "firstName lastName email")
                        .sort(sort)
                        .skip(skip)
                        .limit(limit)
                        .lean(),
                    project_model_1.ProjectModel.countDocuments(queryCondition),
                ]);
                if (!includeMetrics || projects.length === 0) {
                    return {
                        projects,
                        pagination: {
                            current: page,
                            total: Math.ceil(total / limit),
                            count: projects.length,
                            order: sortOrder,
                            totalRecords: total,
                        },
                    };
                }
                const projectIds = projects.map((p) => p._id.toString());
                const metricsStartTime = new Date(Date.now() - metricsTimeRange * 60 * 60 * 1000);
                const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
                const [logCounts, errorCounts, responseTimeMetrics, recentActivityMetrics, performanceMetrics, trendMetrics,] = yield Promise.all([
                    // Total log counts
                    log_model_1.LogModel.aggregate([
                        { $match: { projectId: { $in: projectIds } } },
                        { $group: { _id: "$projectId", count: { $sum: 1 } } },
                    ]),
                    // Error counts and rates
                    log_model_1.LogModel.aggregate([
                        {
                            $match: {
                                projectId: { $in: projectIds },
                                timestamp: { $gte: metricsStartTime.toISOString() },
                            },
                        },
                        {
                            $group: {
                                _id: "$projectId",
                                totalLogs: { $sum: 1 },
                                totalErrors: {
                                    $sum: {
                                        $cond: [
                                            { $in: ["$level", ["error", "fatal", "warn"]] },
                                            1,
                                            0,
                                        ],
                                    },
                                },
                                criticalErrors: {
                                    $sum: {
                                        $cond: [{ $in: ["$level", ["error", "fatal"]] }, 1, 0],
                                    },
                                },
                            },
                        },
                    ]),
                    // Response time metrics
                    log_model_1.LogModel.aggregate([
                        {
                            $match: {
                                projectId: { $in: projectIds },
                                timestamp: { $gte: metricsStartTime.toISOString() },
                                "data.responseTime": { $exists: true, $type: "number" },
                            },
                        },
                        {
                            $group: {
                                _id: "$projectId",
                                avgResponseTime: { $avg: "data.responseTime" },
                                responseTimes: { $push: "data.responseTime" },
                            },
                        },
                        {
                            $addFields: {
                                sortedTimes: {
                                    $sortArray: { input: "$responseTimes", sortBy: 1 },
                                },
                            },
                        },
                        {
                            $project: {
                                projectId: "$_id",
                                avgResponseTime: {
                                    $round: [{ $toDouble: "$avgResponseTime" }, 2],
                                },
                                p95ResponseTime: {
                                    $arrayElemAt: [
                                        "$sortedTimes",
                                        { $floor: { $multiply: [{ $size: "$sortedTimes" }, 0.95] } },
                                    ],
                                },
                                _id: 0,
                            },
                        },
                    ]),
                    // Recent activity (last 24 hours)
                    log_model_1.LogModel.aggregate([
                        {
                            $match: {
                                projectId: { $in: projectIds },
                                timestamp: { $gte: last24Hours.toISOString() },
                            },
                        },
                        {
                            $group: {
                                _id: "$projectId",
                                logsLast24h: { $sum: 1 },
                                errorsLast24h: {
                                    $sum: {
                                        $cond: [
                                            { $in: ["$level", ["error", "fatal", "warn"]] },
                                            1,
                                            0,
                                        ],
                                    },
                                },
                            },
                        },
                    ]),
                    // Performance metrics (uptime calculation)
                    log_model_1.LogModel.aggregate([
                        { $match: { projectId: { $in: projectIds } } },
                        {
                            $group: {
                                _id: "$projectId",
                                firstLog: { $min: { $toDate: "$timestamp" } },
                                totalMinutes: {
                                    $sum: {
                                        $divide: [
                                            {
                                                $subtract: [{ $toDate: "$timestamp" }, metricsStartTime],
                                            },
                                            60000, // Convert to minutes
                                        ],
                                    },
                                },
                            },
                        },
                    ]),
                    // Trend analysis (compare recent vs older periods)
                    log_model_1.LogModel.aggregate([
                        {
                            $match: {
                                projectId: { $in: projectIds },
                                timestamp: {
                                    $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
                                },
                            },
                        },
                        {
                            $addFields: {
                                isRecent: {
                                    $gte: [
                                        { $toDate: "$timestamp" },
                                        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                                    ],
                                },
                            },
                        },
                        {
                            $group: {
                                _id: "$projectId",
                                recentLogs: { $sum: { $cond: ["$isRecent", 1, 0] } },
                                olderLogs: { $sum: { $cond: ["$isRecent", 0, 1] } },
                                recentErrors: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $and: [
                                                    "$isRecent",
                                                    { $in: ["$level", ["error", "fatal"]] },
                                                ],
                                            },
                                            1,
                                            0,
                                        ],
                                    },
                                },
                                olderErrors: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $and: [
                                                    { $not: "$isRecent" },
                                                    { $in: ["$level", ["error", "fatal"]] },
                                                ],
                                            },
                                            1,
                                            0,
                                        ],
                                    },
                                },
                                recentAvgResponseTime: {
                                    $avg: {
                                        $cond: [
                                            { $and: ["$isRecent", { $type: "$data.responseTime" }] },
                                            "$data.responseTime",
                                            null,
                                        ],
                                    },
                                },
                                olderAvgResponseTime: {
                                    $avg: {
                                        $cond: [
                                            {
                                                $and: [
                                                    { $not: "$isRecent" },
                                                    { $type: "$data.responseTime" },
                                                ],
                                            },
                                            "$data.responseTime",
                                            null,
                                        ],
                                    },
                                },
                            },
                        },
                    ]),
                ]);
                // Create lookup maps for quick access
                const logCountMap = new Map(logCounts.map((item) => [item._id, item.count]));
                const errorCountMap = new Map(errorCounts.map((item) => [item._id, item]));
                const responseTimeMap = new Map(responseTimeMetrics.map((item) => [item.projectId, item]));
                const recentActivityMap = new Map(recentActivityMetrics.map((item) => [item._id, item]));
                const performanceMap = new Map(performanceMetrics.map((item) => [item._id, item]));
                const trendMap = new Map(trendMetrics.map((item) => [item._id, item]));
                const calculateHealthScore = (projectId) => {
                    const errorData = errorCountMap.get(projectId) || {
                        totalLogs: 0,
                        totalErrors: 0,
                        criticalErrors: 0,
                    };
                    const recentActivity = recentActivityMap.get(projectId) || {
                        logsLast24h: 0,
                        errorsLast24h: 0,
                    };
                    const responseTime = responseTimeMap.get(projectId) || {
                        avgResponseTime: 0,
                    };
                    let score = 100;
                    // Error rate impact (0-40 points deduction)
                    if (errorData.totalLogs > 0) {
                        const errorRate = (errorData.totalErrors / errorData.totalLogs) * 100;
                        if (errorRate > 20)
                            score -= 40;
                        else if (errorRate > 10)
                            score -= 30;
                        else if (errorRate > 5)
                            score -= 20;
                        else if (errorRate > 1)
                            score -= 10;
                    }
                    // Response time impact (0-30 points deduction)
                    if (responseTime.avgResponseTime > 0) {
                        if (responseTime.avgResponseTime > 5000)
                            score -= 30;
                        else if (responseTime.avgResponseTime > 3000)
                            score -= 20;
                        else if (responseTime.avgResponseTime > 1000)
                            score -= 10;
                    }
                    // Recent activity impact (0-30 points deduction)
                    if (recentActivity.logsLast24h === 0)
                        score -= 30;
                    else if (recentActivity.logsLast24h < 10)
                        score -= 15;
                    // Recent error rate impact
                    if (recentActivity.logsLast24h > 0) {
                        const recentErrorRate = (recentActivity.errorsLast24h / recentActivity.logsLast24h) * 100;
                        if (recentErrorRate > 15)
                            score -= 15;
                        else if (recentErrorRate > 10)
                            score -= 10;
                        else if (recentErrorRate > 5)
                            score -= 5;
                    }
                    return Math.max(0, Math.min(100, Math.round(score)));
                };
                // Helper function to calculate trends
                const calculateTrends = (projectId) => {
                    const trends = trendMap.get(projectId);
                    if (!trends) {
                        return {
                            errorTrend: "stable",
                            activityTrend: "stable",
                            performanceTrend: "stable",
                        };
                    }
                    const recentErrorRate = trends.recentLogs > 0 ? trends.recentErrors / trends.recentLogs : 0;
                    const olderErrorRate = trends.olderLogs > 0 ? trends.olderErrors / trends.olderLogs : 0;
                    let errorTrend = "stable";
                    if (recentErrorRate > olderErrorRate * 1.2)
                        errorTrend = "increasing";
                    else if (recentErrorRate < olderErrorRate * 0.8)
                        errorTrend = "decreasing";
                    let activityTrend = "stable";
                    if (trends.recentLogs > trends.olderLogs * 1.2)
                        activityTrend = "increasing";
                    else if (trends.recentLogs < trends.olderLogs * 0.8)
                        activityTrend = "decreasing";
                    let performanceTrend = "stable";
                    if (trends.recentAvgResponseTime && trends.olderAvgResponseTime) {
                        if (trends.recentAvgResponseTime < trends.olderAvgResponseTime * 0.9)
                            performanceTrend = "improving";
                        else if (trends.recentAvgResponseTime >
                            trends.olderAvgResponseTime * 1.1)
                            performanceTrend = "degrading";
                    }
                    return { errorTrend, activityTrend, performanceTrend };
                };
                // Enrich projects with metrics
                const enrichedProjects = projects.map((project) => {
                    const projectId = project._id.toString();
                    const errorData = errorCountMap.get(projectId) || {
                        totalLogs: 0,
                        totalErrors: 0,
                        criticalErrors: 0,
                    };
                    const responseTime = responseTimeMap.get(projectId) || {
                        avgResponseTime: 0,
                        p95ResponseTime: 0,
                    };
                    const recentActivity = recentActivityMap.get(projectId) || {
                        logsLast24h: 0,
                        errorsLast24h: 0,
                    };
                    const performance = performanceMap.get(projectId) || {
                        firstLog: null,
                        lastLog: null,
                    };
                    const trends = calculateTrends(projectId);
                    // Calculate uptime percentage
                    const now = Date.now();
                    const projectAge = now - new Date(project.createdAt).getTime();
                    const lastActivity = project.lastIngestedAt
                        ? now - new Date(project.lastIngestedAt).getTime()
                        : projectAge;
                    const uptimePercentage = projectAge > 0
                        ? Math.max(0, Math.min(100, ((projectAge - lastActivity) / projectAge) * 100))
                        : 100;
                    const errorRate = errorData.totalLogs > 0
                        ? (errorData.totalErrors / errorData.totalLogs) * 100
                        : 0;
                    const healthScore = calculateHealthScore(projectId);
                    return Object.assign(Object.assign({}, project), { metrics: {
                            totalLogs: logCountMap.get(projectId) || project.logCount || 0,
                            totalErrorCount: errorData.totalErrors,
                            errorRate: Math.round(errorRate * 100) / 100,
                            averageResponseTime: Math.round(responseTime.avgResponseTime || 0),
                            healthScore,
                            recentActivity: {
                                logsLast24h: recentActivity.logsLast24h,
                                errorsLast24h: recentActivity.errorsLast24h,
                                isActive: recentActivity.logsLast24h > 0,
                            },
                            performance: {
                                p95ResponseTime: Math.round(responseTime.p95ResponseTime || 0),
                                uptimePercentage: Math.round(uptimePercentage * 100) / 100,
                            },
                        }, trends });
                });
                // Calculate aggregated metrics
                const aggregatedMetrics = {
                    totalProjects: projects.length,
                    totalLogs: enrichedProjects.reduce((sum, p) => sum + p.metrics.totalLogs, 0),
                    totalErrors: enrichedProjects.reduce((sum, p) => sum + p.metrics.totalErrorCount, 0),
                    averageHealthScore: Math.round(enrichedProjects.reduce((sum, p) => sum + p.metrics.healthScore, 0) /
                        Math.max(1, projects.length)),
                    activeProjects: enrichedProjects.filter((p) => p.metrics.recentActivity.isActive).length,
                };
                return {
                    projects: enrichedProjects,
                    pagination: {
                        current: page,
                        total: Math.ceil(total / limit),
                        count: projects.length,
                        order: sortOrder,
                        totalRecords: total,
                    },
                    aggregatedMetrics,
                };
            }
            catch (error) {
                throw new Error(`Failed to fetch projects: ${error}`);
            }
        });
    }
    static getProjectById(id_1) {
        return __awaiter(this, arguments, void 0, function* (id, populateRefs = false) {
            try {
                this.validateObjectId(id);
                let query = project_model_1.ProjectModel.findById(id).select("-__v");
                if (populateRefs) {
                    query = query
                        .populate("ownerId", "firstName lastName email")
                        .populate("teamMembers.user", "firstName lastName email");
                }
                const project = yield query.lean();
                if (!project) {
                    throw new ProjectNotFoundError(id);
                }
                return project;
            }
            catch (error) {
                if (error instanceof ProjectNotFoundError ||
                    error instanceof ProjectValidationError) {
                    throw error;
                }
                throw new Error(`Failed to fetch project: ${error}`);
            }
        });
    }
    static updateProject(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.validateObjectId(id);
                // Check if project exists first
                const existingProject = yield project_model_1.ProjectModel.findById(id);
                if (!existingProject) {
                    throw new ProjectNotFoundError(id);
                }
                // Validate name if provided
                if (data.name !== undefined) {
                    if (!data.name || data.name.trim().length === 0) {
                        throw new ProjectValidationError("Project name cannot be empty");
                    }
                    if (data.name.length > 100) {
                        throw new ProjectValidationError("Project name cannot exceed 100 characters");
                    }
                    // Check for duplicate names (excluding current project)
                    const duplicateProject = yield project_model_1.ProjectModel.findOne({
                        name: data.name.trim(),
                        _id: { $ne: id },
                    });
                    if (duplicateProject) {
                        throw new ProjectValidationError("Project with this name already exists");
                    }
                }
                const updateData = Object.assign(Object.assign(Object.assign({}, data), (data.name && { name: data.name.trim() })), { updatedAt: new Date() });
                const updatedProject = yield project_model_1.ProjectModel.findByIdAndUpdate(id, updateData, {
                    new: true,
                    runValidators: true,
                    select: "-__v",
                }).lean();
                return updatedProject;
            }
            catch (error) {
                if (error instanceof ProjectNotFoundError ||
                    error instanceof ProjectValidationError) {
                    throw error;
                }
                throw new Error(`Failed to update project: ${error}`);
            }
        });
    }
    static deleteProject(id_1) {
        return __awaiter(this, arguments, void 0, function* (id, softDelete = true) {
            try {
                this.validateObjectId(id);
                if (softDelete) {
                    const updatedProject = yield project_model_1.ProjectModel.findByIdAndUpdate(id, { isActive: false, updatedAt: new Date() }, { new: true });
                    if (!updatedProject) {
                        throw new ProjectNotFoundError(id);
                    }
                    return { success: true, deletedId: id, type: "soft" };
                }
                else {
                    const deletedProject = yield project_model_1.ProjectModel.findByIdAndDelete(id);
                    if (!deletedProject) {
                        throw new ProjectNotFoundError(id);
                    }
                    // TODO: Consider also deleting associated logs
                    log_model_1.LogModel.deleteMany({ projectId: id });
                    return { success: true, deletedId: id, type: "hard" };
                }
            }
            catch (error) {
                if (error instanceof ProjectNotFoundError ||
                    error instanceof ProjectValidationError) {
                    throw error;
                }
                throw new Error(`Failed to delete project: ${error}`);
            }
        });
    }
    static restoreProject(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.validateObjectId(id);
                const restoredProject = yield project_model_1.ProjectModel.findByIdAndUpdate(id, { isActive: true, updatedAt: new Date() }, { new: true });
                if (!restoredProject) {
                    throw new ProjectNotFoundError(id);
                }
                return { success: true, restoredId: id };
            }
            catch (error) {
                if (error instanceof ProjectNotFoundError ||
                    error instanceof ProjectValidationError) {
                    throw error;
                }
                throw new Error(`Failed to restore project: ${error}`);
            }
        });
    }
    static regenerateApiKey(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.validateObjectId(id);
                const newKey = (0, uuid_1.v4)();
                const updatedProject = yield project_model_1.ProjectModel.findByIdAndUpdate(id, {
                    apiKey: newKey,
                    updatedAt: new Date(),
                }, { new: true });
                if (!updatedProject) {
                    throw new ProjectNotFoundError(id);
                }
                return {
                    apiKey: newKey,
                    projectId: id,
                    regeneratedAt: new Date(),
                };
            }
            catch (error) {
                if (error instanceof ProjectNotFoundError ||
                    error instanceof ProjectValidationError) {
                    throw error;
                }
                throw new Error(`Failed to regenerate API key: ${error}`);
            }
        });
    }
    static getProjectStats(id_1) {
        return __awaiter(this, arguments, void 0, function* (id, recalculate = false) {
            try {
                this.validateObjectId(id);
                if (recalculate) {
                    yield this.recalculateProjectStats(id);
                }
                const project = yield project_model_1.ProjectModel.findById(id)
                    .select("logCount alertRuleCount lastIngestedAt name isActive tags")
                    .lean();
                if (!project) {
                    throw new ProjectNotFoundError(id);
                }
                // Get additional stats from logs collection
                const [errorLogsCount, warningLogsCount, recentLogsCount, topLevels] = yield Promise.all([
                    log_model_1.LogModel.countDocuments({ projectId: id, level: "error" }),
                    log_model_1.LogModel.countDocuments({ projectId: id, level: "warn" }),
                    log_model_1.LogModel.countDocuments({
                        projectId: id,
                        timestamp: {
                            $gte: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                        },
                    }),
                    log_model_1.LogModel.aggregate([
                        { $match: { projectId: id } },
                        { $group: { _id: "$level", count: { $sum: 1 } } },
                        { $sort: { count: -1 } },
                        { $limit: 5 },
                    ]),
                ]);
                return {
                    projectId: id,
                    projectName: project.name,
                    isActive: project.isActive,
                    logCount: project.logCount || 0,
                    alertRulesCount: project.alertRuleCount || 0,
                    errorLogsCount,
                    warningLogsCount,
                    recentLogsCount,
                    topLogLevels: topLevels,
                    tags: project.tags || [],
                    lastIngestedAt: project.lastIngestedAt,
                    statsGeneratedAt: new Date(),
                };
            }
            catch (error) {
                if (error instanceof ProjectNotFoundError ||
                    error instanceof ProjectValidationError) {
                    throw error;
                }
                throw new Error(`Failed to get project stats: ${error}`);
            }
        });
    }
    static syncLogCount(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.validateObjectId(projectId);
                const project = yield project_model_1.ProjectModel.findById(projectId);
                if (!project) {
                    throw new ProjectNotFoundError(projectId);
                }
                const actualCount = yield this.updateLogCount(projectId);
                return {
                    projectId,
                    previousCount: project.logCount || 0,
                    actualCount,
                    synced: true,
                    syncedAt: new Date(),
                };
            }
            catch (error) {
                if (error instanceof ProjectNotFoundError ||
                    error instanceof ProjectValidationError) {
                    throw error;
                }
                throw new Error(`Failed to sync log count: ${error}`);
            }
        });
    }
    static incrementLogCount(projectId_1) {
        return __awaiter(this, arguments, void 0, function* (projectId, increment = 1) {
            try {
                this.validateObjectId(projectId);
                const updatedProject = yield project_model_1.ProjectModel.findByIdAndUpdate(projectId, {
                    $inc: { logCount: increment },
                    lastIngestedAt: new Date(),
                }, { new: true });
                if (!updatedProject) {
                    throw new ProjectNotFoundError(projectId);
                }
                return {
                    projectId,
                    newCount: updatedProject.logCount,
                    increment,
                };
            }
            catch (error) {
                throw new ProjectOperationError(`Failed to increment log count: ${error}`);
            }
        });
    }
    static syncAllProjectLogCounts() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const projects = yield project_model_1.ProjectModel.find({ isActive: true })
                    .select("_id")
                    .lean();
                const results = [];
                for (const project of projects) {
                    try {
                        const result = yield this.syncLogCount(project._id.toString());
                        results.push(result);
                    }
                    catch (error) {
                        results.push({
                            projectId: project._id.toString(),
                            error: error instanceof Error ? error.message : String(error),
                            synced: false,
                        });
                    }
                }
                return {
                    totalProjects: projects.length,
                    syncedProjects: results.filter((r) => r.synced).length,
                    failedProjects: results.filter((r) => !r.synced).length,
                    results,
                    syncedAt: new Date(),
                };
            }
            catch (error) {
                throw new Error(`Failed to sync all project log counts: ${error}`);
            }
        });
    }
    // Additional utility methods
    static getProjectByApiKey(apiKey) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!apiKey) {
                    throw new ProjectValidationError("API key is required");
                }
                const project = yield project_model_1.ProjectModel.findOne({ apiKey })
                    .select("-__v")
                    .lean();
                if (!project) {
                    throw new ProjectNotFoundError(`project with API key`);
                }
                return project;
            }
            catch (error) {
                if (error instanceof ProjectNotFoundError ||
                    error instanceof ProjectValidationError) {
                    throw error;
                }
                throw new Error(`Failed to find project by API key: ${error}`);
            }
        });
    }
    static searchProjects(query_1) {
        return __awaiter(this, arguments, void 0, function* (query, options = {}) {
            try {
                const { limit = 10, includeInactive = false, tags, userId } = options;
                if (!query || query.trim().length === 0) {
                    throw new ProjectValidationError("Search query is required");
                }
                const searchRegex = new RegExp(query.trim(), "i");
                const filter = {
                    $or: [{ name: searchRegex }, { description: searchRegex }],
                };
                if (!includeInactive) {
                    filter.isActive = true;
                }
                if (tags && tags.length > 0) {
                    filter.tags = { $in: tags };
                }
                if (userId) {
                    this.validateObjectId(userId);
                    const userObjectId = new mongoose_1.Types.ObjectId(userId);
                    filter.$and = [
                        filter.$or ? { $or: filter.$or } : {},
                        {
                            $or: [
                                { ownerId: userObjectId },
                                { "teamMembers.user": userObjectId },
                            ],
                        },
                    ];
                    delete filter.$or;
                }
                const projects = yield project_model_1.ProjectModel.find(filter)
                    .select("-__v -apiKey") // Don't expose API keys in search
                    .populate("ownerId", "name email")
                    .limit(limit)
                    .lean();
                return {
                    query: query.trim(),
                    results: projects,
                    count: projects.length,
                };
            }
            catch (error) {
                if (error instanceof ProjectValidationError) {
                    throw error;
                }
                throw new Error(`Failed to search projects: ${error}`);
            }
        });
    }
    // Tag management methods
    static addProjectTags(projectId, tags) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.validateObjectId(projectId);
                if (!tags || tags.length === 0) {
                    throw new ProjectValidationError("At least one tag is required");
                }
                const cleanTags = tags
                    .map((tag) => tag.trim().toLowerCase())
                    .filter((tag) => tag.length > 0);
                const updatedProject = yield project_model_1.ProjectModel.findByIdAndUpdate(projectId, {
                    $addToSet: { tags: { $each: cleanTags } },
                    updatedAt: new Date(),
                }, { new: true });
                if (!updatedProject) {
                    throw new ProjectNotFoundError(projectId);
                }
                return {
                    projectId,
                    addedTags: cleanTags,
                    allTags: updatedProject.tags,
                };
            }
            catch (error) {
                if (error instanceof ProjectNotFoundError ||
                    error instanceof ProjectValidationError) {
                    throw error;
                }
                throw new Error(`Failed to add project tags: ${error}`);
            }
        });
    }
    static removeProjectTags(projectId, tags) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.validateObjectId(projectId);
                if (!tags || tags.length === 0) {
                    throw new ProjectValidationError("At least one tag is required");
                }
                const cleanTags = tags.map((tag) => tag.trim().toLowerCase());
                const updatedProject = yield project_model_1.ProjectModel.findByIdAndUpdate(projectId, {
                    $pull: { tags: { $in: cleanTags } },
                    updatedAt: new Date(),
                }, { new: true });
                if (!updatedProject) {
                    throw new ProjectNotFoundError(projectId);
                }
                return {
                    projectId,
                    removedTags: cleanTags,
                    allTags: updatedProject.tags,
                };
            }
            catch (error) {
                if (error instanceof ProjectNotFoundError ||
                    error instanceof ProjectValidationError) {
                    throw error;
                }
                throw new Error(`Failed to remove project tags: ${error}`);
            }
        });
    }
    // Rate limit configuration methods
    static updateRateLimitConfig(projectId, config) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.validateObjectId(projectId);
                if (config.maxRequestsPerMinute && config.maxRequestsPerMinute < 1) {
                    throw new ProjectValidationError("Max requests per minute must be at least 1");
                }
                if (config.burstLimit && config.burstLimit < 1) {
                    throw new ProjectValidationError("Burst limit must be at least 1");
                }
                const updateData = { updatedAt: new Date() };
                if (config.maxRequestsPerMinute !== undefined) {
                    updateData["rateLimitConfig.maxRequestsPerMinute"] =
                        config.maxRequestsPerMinute;
                }
                if (config.burstLimit !== undefined) {
                    updateData["rateLimitConfig.burstLimit"] = config.burstLimit;
                }
                const updatedProject = yield project_model_1.ProjectModel.findByIdAndUpdate(projectId, updateData, { new: true });
                if (!updatedProject) {
                    throw new ProjectNotFoundError(projectId);
                }
                return {
                    projectId,
                    rateLimitConfig: updatedProject.rateLimitConfig,
                };
            }
            catch (error) {
                if (error instanceof ProjectNotFoundError ||
                    error instanceof ProjectValidationError) {
                    throw error;
                }
                throw new Error(`Failed to update rate limit config: ${error}`);
            }
        });
    }
    // Team member management methods (existing methods updated)
    static addTeamMember(projectId_1, userId_1) {
        return __awaiter(this, arguments, void 0, function* (projectId, userId, role = "viewer") {
            try {
                this.validateObjectId(projectId);
                this.validateObjectId(userId);
                const project = yield project_model_1.ProjectModel.findById(projectId);
                if (!project) {
                    throw new ProjectNotFoundError(projectId);
                }
                // Check if user is already a team member
                const existingMember = project.teamMembers.find((member) => member.user.toString() === userId);
                if (existingMember) {
                    throw new ProjectValidationError("User is already a team member of this project");
                }
                project.teamMembers.push({ user: new mongoose_1.Types.ObjectId(userId), role });
                project.updatedAt = new Date();
                const updatedProject = yield project.save();
                return {
                    projectId: updatedProject._id,
                    teamMember: {
                        userId: userId,
                        role: role,
                    },
                    totalMembers: updatedProject.teamMembers.length,
                };
            }
            catch (error) {
                if (error instanceof ProjectNotFoundError ||
                    error instanceof ProjectValidationError) {
                    throw error;
                }
                throw new Error(`Failed to add team member: ${error}`);
            }
        });
    }
    static removeTeamMember(projectId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                this.validateObjectId(projectId);
                this.validateObjectId(userId);
                const project = yield project_model_1.ProjectModel.findById(projectId);
                if (!project) {
                    throw new ProjectNotFoundError(projectId);
                }
                // Prevent removing the owner
                if (((_a = project.ownerId) === null || _a === void 0 ? void 0 : _a.toString()) === userId) {
                    throw new ProjectValidationError("Cannot remove project owner from team members");
                }
                const memberIndex = project.teamMembers.findIndex((member) => member.user.toString() === userId);
                if (memberIndex === -1) {
                    throw new ProjectValidationError("User is not a team member of this project");
                }
                project.teamMembers.splice(memberIndex, 1);
                project.updatedAt = new Date();
                const updatedProject = yield project.save();
                return {
                    projectId: updatedProject._id,
                    removedUserId: userId,
                    totalMembers: updatedProject.teamMembers.length,
                };
            }
            catch (error) {
                if (error instanceof ProjectNotFoundError ||
                    error instanceof ProjectValidationError) {
                    throw error;
                }
                throw new Error(`Failed to remove team member: ${error}`);
            }
        });
    }
    static updateTeamMemberRole(projectId, userId, role) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.validateObjectId(projectId);
                this.validateObjectId(userId);
                const project = yield project_model_1.ProjectModel.findById(projectId);
                if (!project) {
                    throw new ProjectNotFoundError(projectId);
                }
                const member = project.teamMembers.find((member) => member.user.toString() === userId);
                if (!member) {
                    throw new ProjectValidationError("User is not a team member of this project");
                }
                member.role = role;
                project.updatedAt = new Date();
                const updatedProject = yield project.save();
                return {
                    projectId: updatedProject._id,
                    updatedUser: {
                        userId: userId,
                        role: role,
                    },
                };
            }
            catch (error) {
                if (error instanceof ProjectNotFoundError ||
                    error instanceof ProjectValidationError) {
                    throw error;
                }
                throw new Error(`Failed to update team member role: ${error}`);
            }
        });
    }
    static getTeamMembers(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.validateObjectId(projectId);
                const project = yield project_model_1.ProjectModel.findById(projectId)
                    .select("teamMembers ownerId")
                    .populate("teamMembers.user", "firstName lastName email")
                    .populate("ownerId", "firstName lastName email")
                    .lean();
                if (!project) {
                    throw new ProjectNotFoundError(projectId);
                }
                return {
                    projectId,
                    owner: project.ownerId,
                    teamMembers: project.teamMembers,
                    totalMembers: project.teamMembers.length,
                };
            }
            catch (error) {
                if (error instanceof ProjectNotFoundError ||
                    error instanceof ProjectValidationError) {
                    throw error;
                }
                throw new Error(`Failed to get team members: ${error}`);
            }
        });
    }
    // Bulk operations
    static bulkUpdateProjects(projectIds, updateData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                projectIds.forEach((id) => this.validateObjectId(id));
                const result = yield project_model_1.ProjectModel.updateMany({ _id: { $in: projectIds } }, Object.assign(Object.assign({}, updateData), { updatedAt: new Date() }));
                return {
                    matchedCount: result.matchedCount,
                    modifiedCount: result.modifiedCount,
                    updatedFields: Object.keys(updateData),
                };
            }
            catch (error) {
                throw new Error(`Failed to bulk update projects: ${error}`);
            }
        });
    }
    static getProjectsAnalytics() {
        return __awaiter(this, arguments, void 0, function* (options = {}) {
            try {
                const { startDate, endDate, groupBy = "day" } = options;
                const matchStage = {};
                if (startDate || endDate) {
                    matchStage.createdAt = {};
                    if (startDate)
                        matchStage.createdAt.$gte = startDate;
                    if (endDate)
                        matchStage.createdAt.$lte = endDate;
                }
                const [creationTrends, tagDistribution, totalStats] = yield Promise.all([
                    project_model_1.ProjectModel.aggregate([
                        ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),
                        {
                            $group: {
                                _id: {
                                    $dateToString: {
                                        format: groupBy === "day"
                                            ? "%Y-%m-%d"
                                            : groupBy === "week"
                                                ? "%Y-%U"
                                                : "%Y-%m",
                                        date: "$createdAt",
                                    },
                                },
                                count: { $sum: 1 },
                            },
                        },
                        { $sort: { _id: 1 } },
                    ]),
                    project_model_1.ProjectModel.aggregate([
                        { $unwind: "$tags" },
                        { $group: { _id: "$tags", count: { $sum: 1 } } },
                        { $sort: { count: -1 } },
                        { $limit: 10 },
                    ]),
                    project_model_1.ProjectModel.aggregate([
                        {
                            $facet: {
                                totalProjects: [{ $count: "count" }],
                                activeProjects: [
                                    { $match: { isActive: true } },
                                    { $count: "count" },
                                ],
                                totalLogs: [
                                    {
                                        $lookup: {
                                            from: "logs",
                                            localField: "_id",
                                            foreignField: "projectId",
                                            as: "logs",
                                        },
                                    },
                                    { $unwind: "$logs" },
                                    { $count: "count" },
                                ],
                            },
                        },
                        {
                            $project: {
                                totalProjects: { $arrayElemAt: ["$totalProjects.count", 0] },
                                activeProjects: { $arrayElemAt: ["$activeProjects.count", 0] },
                                totalLogs: { $arrayElemAt: ["$totalLogs.count", 0] },
                            },
                        },
                        {
                            $addFields: {
                                avgLogsPerProject: {
                                    $cond: [
                                        { $gt: ["$totalProjects", 0] },
                                        { $divide: ["$totalLogs", "$totalProjects"] },
                                        0,
                                    ],
                                },
                            },
                        },
                    ]),
                ]);
                return {
                    totalStats: totalStats[0] || {
                        totalProjects: 0,
                        activeProjects: 0,
                        totalLogs: 0,
                        avgLogsPerProject: 0,
                    },
                    creationTrends,
                    tagDistribution,
                    generatedAt: new Date(),
                };
            }
            catch (error) {
                throw new Error(`Failed to get projects analytics: ${error}`);
            }
        });
    }
    // Export/Import functionality
    static exportProjectData(projectId_1) {
        return __awaiter(this, arguments, void 0, function* (projectId, options = {}) {
            try {
                this.validateObjectId(projectId);
                const project = yield project_model_1.ProjectModel.findById(projectId)
                    .populate("ownerId", "name email")
                    .populate("teamMembers.user", "name email")
                    .lean();
                if (!project) {
                    throw new ProjectNotFoundError(projectId);
                }
                const exportData = {
                    project,
                    exportedAt: new Date(),
                    exportOptions: options,
                };
                if (options.includeLogs) {
                    const logQuery = { projectId };
                    if (options.dateRange) {
                        logQuery.timestamp = {
                            $gte: options.dateRange.start.toISOString(),
                            $lte: options.dateRange.end.toISOString(),
                        };
                    }
                    const logs = yield log_model_1.LogModel.find(logQuery).lean();
                    exportData.logs = logs;
                    exportData.logCount = logs.length;
                }
                return exportData;
            }
            catch (error) {
                if (error instanceof ProjectNotFoundError ||
                    error instanceof ProjectValidationError) {
                    throw error;
                }
                throw new Error(`Failed to export project data: ${error}`);
            }
        });
    }
    // Health check and maintenance methods
    static healthCheck() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const [totalProjects, activeProjects, projectsWithLogs, recentActivity] = yield Promise.all([
                    project_model_1.ProjectModel.countDocuments(),
                    project_model_1.ProjectModel.countDocuments({ isActive: true }),
                    project_model_1.ProjectModel.countDocuments({ logCount: { $gt: 0 } }),
                    project_model_1.ProjectModel.countDocuments({
                        lastIngestedAt: {
                            $gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                        },
                    }),
                ]);
                return {
                    status: "healthy",
                    metrics: {
                        totalProjects,
                        activeProjects,
                        inactiveProjects: totalProjects - activeProjects,
                        projectsWithLogs,
                        projectsWithRecentActivity: recentActivity,
                    },
                    checkedAt: new Date(),
                };
            }
            catch (error) {
                return {
                    status: "unhealthy",
                    error: error instanceof Error ? error.message : String(error),
                    checkedAt: new Date(),
                };
            }
        });
    }
    // Project archival system
    static archiveProject(projectId, archiveReason) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.validateObjectId(projectId);
                const project = yield project_model_1.ProjectModel.findById(projectId);
                if (!project) {
                    throw new ProjectNotFoundError(projectId);
                }
                if (!project.isActive) {
                    throw new ProjectValidationError("Project is already archived");
                }
                const archiveData = {
                    isActive: false,
                    archivedAt: new Date(),
                    archiveReason: archiveReason || "Manual archive",
                    updatedAt: new Date(),
                };
                const archivedProject = yield project_model_1.ProjectModel.findByIdAndUpdate(projectId, archiveData, { new: true });
                if (!archivedProject) {
                    throw new ProjectNotFoundError(projectId);
                }
                return {
                    projectId,
                    projectName: archivedProject.name,
                    archivedAt: archiveData.archivedAt,
                    reason: archiveData.archiveReason,
                };
            }
            catch (error) {
                if (error instanceof ProjectNotFoundError ||
                    error instanceof ProjectValidationError) {
                    throw error;
                }
                throw new Error(`Failed to archive project: ${error}`);
            }
        });
    }
    // Project duplication
    static duplicateProject(sourceProjectId_1, newName_1, ownerId_1) {
        return __awaiter(this, arguments, void 0, function* (sourceProjectId, newName, ownerId, options = {}) {
            try {
                this.validateObjectId(sourceProjectId);
                this.validateObjectId(ownerId);
                const sourceProject = yield project_model_1.ProjectModel.findById(sourceProjectId);
                if (!sourceProject) {
                    throw new ProjectNotFoundError(sourceProjectId);
                }
                // Check if new name is available
                const existingProject = yield project_model_1.ProjectModel.findOne({
                    name: newName.trim(),
                });
                if (existingProject) {
                    throw new ProjectValidationError("Project with this name already exists");
                }
                const { copyTeamMembers = false, copyTags = true, copyRateLimitConfig = true, } = options;
                const newProjectData = {
                    name: newName.trim(),
                    description: sourceProject.description,
                    ownerId: new mongoose_1.Types.ObjectId(ownerId),
                    apiKey: (0, uuid_1.v4)(),
                    isActive: true,
                    logCount: 0,
                    alertRuleCount: 0,
                    teamMembers: [{ user: new mongoose_1.Types.ObjectId(ownerId), role: "admin" }],
                };
                if (copyTeamMembers && sourceProject.teamMembers.length > 0) {
                    // Add original team members (excluding the new owner if they're already a member)
                    const additionalMembers = sourceProject.teamMembers.filter((member) => member.user.toString() !== ownerId);
                    newProjectData.teamMembers.push(...additionalMembers);
                }
                if (copyTags && sourceProject.tags && sourceProject.tags.length > 0) {
                    newProjectData.tags = [...sourceProject.tags];
                }
                if (copyRateLimitConfig && sourceProject.rateLimitConfig) {
                    newProjectData.rateLimitConfig = Object.assign({}, sourceProject.rateLimitConfig);
                }
                if (sourceProject.integrationSettings) {
                    newProjectData.integrationSettings = Object.assign({}, sourceProject.integrationSettings);
                }
                const duplicatedProject = new project_model_1.ProjectModel(newProjectData);
                const savedProject = yield duplicatedProject.save();
                return {
                    sourceProjectId,
                    newProjectId: savedProject._id,
                    newProjectName: savedProject.name,
                    copiedElements: {
                        teamMembers: copyTeamMembers,
                        tags: copyTags,
                        rateLimitConfig: copyRateLimitConfig,
                    },
                    createdAt: savedProject.createdAt,
                };
            }
            catch (error) {
                if (error instanceof ProjectNotFoundError ||
                    error instanceof ProjectValidationError) {
                    throw error;
                }
                throw new Error(`Failed to duplicate project: ${error}`);
            }
        });
    }
    // Project transfer ownership
    static transferOwnership(projectId, newOwnerId, currentOwnerId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                this.validateObjectId(projectId);
                this.validateObjectId(newOwnerId);
                this.validateObjectId(currentOwnerId);
                const project = yield project_model_1.ProjectModel.findById(projectId);
                if (!project) {
                    throw new ProjectNotFoundError(projectId);
                }
                // Verify current ownership
                if (((_a = project.ownerId) === null || _a === void 0 ? void 0 : _a.toString()) !== currentOwnerId) {
                    throw new ProjectValidationError("Only the current owner can transfer ownership");
                }
                // Check if new owner is already a team member
                const newOwnerMember = project.teamMembers.find((member) => member.user.toString() === newOwnerId);
                // Update ownership
                project.ownerId = new mongoose_1.Types.ObjectId(newOwnerId);
                // Ensure new owner is in team members with admin role
                if (newOwnerMember) {
                    newOwnerMember.role = "admin";
                }
                else {
                    project.teamMembers.push({
                        user: new mongoose_1.Types.ObjectId(newOwnerId),
                        role: "admin",
                    });
                }
                // Optionally keep previous owner as team member
                const previousOwnerMember = project.teamMembers.find((member) => member.user.toString() === currentOwnerId);
                if (!previousOwnerMember) {
                    project.teamMembers.push({
                        user: new mongoose_1.Types.ObjectId(currentOwnerId),
                        role: "admin",
                    });
                }
                project.updatedAt = new Date();
                const updatedProject = yield project.save();
                return {
                    projectId,
                    projectName: updatedProject.name,
                    previousOwnerId: currentOwnerId,
                    newOwnerId,
                    transferredAt: new Date(),
                };
            }
            catch (error) {
                if (error instanceof ProjectNotFoundError ||
                    error instanceof ProjectValidationError) {
                    throw error;
                }
                throw new Error(`Failed to transfer project ownership: ${error}`);
            }
        });
    }
    // Integration settings management
    static updateIntegrationSettings(projectId, integrationSettings) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.validateObjectId(projectId);
                const updatedProject = yield project_model_1.ProjectModel.findByIdAndUpdate(projectId, {
                    integrationSettings,
                    updatedAt: new Date(),
                }, { new: true });
                if (!updatedProject) {
                    throw new ProjectNotFoundError(projectId);
                }
                return {
                    projectId,
                    integrationSettings: updatedProject.integrationSettings,
                    updatedAt: updatedProject.updatedAt,
                };
            }
            catch (error) {
                if (error instanceof ProjectNotFoundError ||
                    error instanceof ProjectValidationError) {
                    throw error;
                }
                throw new Error(`Failed to update integration settings: ${error}`);
            }
        });
    }
    static getProjectsSummary(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, options = {}) {
            try {
                const { groupBy = "day", startDate, endDate, includeInactive = false, limit = 5, } = options;
                // Base query to filter by user ownership/membership if userId is provided
                const userFilter = userId
                    ? {
                        $or: [
                            { ownerId: new mongoose_1.Types.ObjectId(userId) },
                            { "teamMembers.user": new mongoose_1.Types.ObjectId(userId) },
                        ],
                    }
                    : {};
                // Date range filter for creation trends
                const dateFilter = {};
                if (startDate || endDate) {
                    dateFilter.createdAt = {};
                    if (startDate)
                        dateFilter.createdAt.$gte = startDate;
                    if (endDate)
                        dateFilter.createdAt.$lte = endDate;
                }
                // Active filter
                const activeFilter = includeInactive ? {} : { isActive: true };
                // Get user's project IDs for log filtering
                let userProjectIds = [];
                if (userId || Object.keys(userFilter).length > 0) {
                    const userProjects = yield project_model_1.ProjectModel.find(userFilter)
                        .select("_id")
                        .lean();
                    userProjectIds = userProjects.map((p) => p._id.toString());
                }
                // Build log match stage based on user's projects or all projects
                const logMatchStage = {};
                if (userProjectIds.length > 0) {
                    logMatchStage.projectId = { $in: userProjectIds };
                }
                // Time filter for recent error logs (last hour)
                const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
                // All promises run concurrently
                const [totalProjectsCount, activeProjectsCount, recentProjects, topProjectsByLogs, popularTags, overallStats, creationTrends, totalLogsAcrossProjects, totalActiveErrorLogs, totalActiveProjects,] = yield Promise.all([
                    // 1. Total Projects Count (matching user filter)
                    project_model_1.ProjectModel.countDocuments(userFilter),
                    // 2. Active Projects Count (matching user filter)
                    project_model_1.ProjectModel.countDocuments(Object.assign(Object.assign({}, userFilter), { isActive: true })),
                    // 3. Recent Projects (active, sorted by last update)
                    project_model_1.ProjectModel.find(Object.assign(Object.assign({}, userFilter), activeFilter))
                        .sort({ updatedAt: -1 })
                        .limit(limit)
                        .select("name logCount lastIngestedAt createdAt ownerId tags")
                        .populate("ownerId", "name email")
                        .lean(),
                    // 4. Top Projects by Log Count (active, sorted by logCount)
                    project_model_1.ProjectModel.find(Object.assign(Object.assign({}, userFilter), activeFilter))
                        .sort({ logCount: -1 })
                        .limit(limit)
                        .select("name logCount createdAt")
                        .lean(),
                    // 5. Popular Tags (active projects, matching user filter)
                    project_model_1.ProjectModel.aggregate([
                        { $match: Object.assign(Object.assign({}, userFilter), activeFilter) },
                        { $unwind: { path: "$tags", preserveNullAndEmptyArrays: false } },
                        {
                            $group: {
                                _id: "$tags",
                                count: { $sum: 1 },
                                projectIds: { $addToSet: "$_id" }, // Track which projects use this tag
                            },
                        },
                        { $match: { _id: { $nin: [null, ""] } } }, // Exclude null/empty tags
                        { $sort: { count: -1 } },
                        { $limit: 10 },
                        {
                            $project: {
                                _id: 1,
                                count: 1,
                                projectCount: { $size: "$projectIds" }, // How many unique projects use this tag
                            },
                        },
                    ]),
                    // 6. Overall Stats with better error handling
                    project_model_1.ProjectModel.aggregate([
                        { $match: Object.assign({}, userFilter) },
                        {
                            $group: {
                                _id: null,
                                totalProjects: { $sum: 1 },
                                activeProjects: { $sum: { $cond: ["$isActive", 1, 0] } },
                                totalLogs: { $sum: { $ifNull: ["$logCount", 0] } }, // Handle null logCount
                                avgLogsPerProject: { $avg: { $ifNull: ["$logCount", 0] } },
                                maxLogs: { $max: { $ifNull: ["$logCount", 0] } },
                                minLogs: { $min: { $ifNull: ["$logCount", 0] } },
                            },
                        },
                        {
                            $project: {
                                _id: 0,
                                totalProjects: 1,
                                activeProjects: 1,
                                totalLogs: 1,
                                avgLogsPerProject: {
                                    $round: [{ $ifNull: ["$avgLogsPerProject", 0] }, 1],
                                },
                                maxLogs: 1,
                                minLogs: 1,
                                inactiveProjects: {
                                    $subtract: ["$totalProjects", "$activeProjects"],
                                },
                            },
                        },
                    ]),
                    // 7. Creation Trends (conditional based on groupBy parameter)
                    groupBy
                        ? project_model_1.ProjectModel.aggregate([
                            { $match: Object.assign(Object.assign({}, userFilter), dateFilter) },
                            {
                                $group: {
                                    _id: {
                                        $dateToString: {
                                            format: groupBy === "day"
                                                ? "%Y-%m-%d"
                                                : groupBy === "week"
                                                    ? "%Y-%U"
                                                    : "%Y-%m",
                                            date: "$createdAt",
                                        },
                                    },
                                    count: { $sum: 1 },
                                    activeCount: { $sum: { $cond: ["$isActive", 1, 0] } },
                                },
                            },
                            { $sort: { _id: 1 } },
                            { $limit: 50 }, // Prevent excessive data
                        ])
                        : Promise.resolve([]),
                    // 8. NEW: Total logs across all projects (from LogModel)
                    log_model_1.LogModel.countDocuments(logMatchStage),
                    // 9. NEW: Total active error logs from the last hour
                    log_model_1.LogModel.countDocuments(Object.assign(Object.assign({}, logMatchStage), { level: "error", timestamp: {
                            $gte: oneHourAgo.toISOString(),
                        } })),
                    // 10. NEW: Total active projects (projects with recent activity in last 24 hours)
                    log_model_1.LogModel.distinct("projectId", Object.assign(Object.assign({}, logMatchStage), { timestamp: {
                            $gte: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                        } })).then((projectIds) => {
                        // If user filter is applied, ensure the active projects belong to the user
                        if (userProjectIds.length > 0) {
                            return projectIds.filter((id) => userProjectIds.includes(id))
                                .length;
                        }
                        return projectIds.length;
                    }),
                ]);
                // Extract the single result from overallStats aggregation
                const overallSummary = overallStats[0] || {
                    totalProjects: 0,
                    activeProjects: 0,
                    inactiveProjects: 0,
                    totalLogs: 0,
                    avgLogsPerProject: 0,
                    maxLogs: 0,
                    minLogs: 0,
                };
                // Add performance metrics
                const performanceMetrics = {
                    responseTime: Date.now(), // You'd calculate this properly
                    cacheHit: false, // Implement caching logic
                    queryCount: 10, // Updated to reflect new queries
                };
                return {
                    summary: {
                        totalProjects: overallSummary.totalProjects,
                        activeProjects: overallSummary.activeProjects,
                        inactiveProjects: overallSummary.inactiveProjects,
                        totalLogsOverall: totalLogsAcrossProjects, // NEW: From LogModel
                        avgLogsPerProject: overallSummary.avgLogsPerProject,
                        maxLogsPerProject: overallSummary.maxLogs,
                        minLogsPerProject: overallSummary.minLogs,
                        // NEW FIELDS:
                        totalActiveErrorLogs: totalActiveErrorLogs, // Error logs from last hour
                        totalActiveProjects: totalActiveProjects, // Projects with activity in last 24h
                    },
                    recentProjects: recentProjects.map((project) => {
                        var _a;
                        return (Object.assign(Object.assign({}, project), { 
                            // Add computed fields
                            daysSinceCreated: Math.floor((Date.now() - new Date((_a = project.createdAt) !== null && _a !== void 0 ? _a : 0).getTime()) /
                                (1000 * 60 * 60 * 24)) }));
                    }),
                    topProjectsByLogs,
                    popularTags,
                    creationTrends: groupBy ? creationTrends : undefined,
                    metadata: Object.assign({ userId: userId || null, filters: {
                            includeInactive,
                            dateRange: startDate || endDate ? { startDate, endDate } : null,
                            groupBy,
                        }, generatedAt: new Date() }, performanceMetrics),
                };
            }
            catch (error) {
                // Enhanced error handling with context
                const errorContext = {
                    userId,
                    options,
                    timestamp: new Date(),
                };
                // Log the error with context (implement your logging strategy)
                console.error("ProjectsSummary Error:", {
                    error: error.message,
                    context: errorContext,
                });
                // Re-throw custom errors or wrap generic ones
                if (error instanceof ProjectOperationError ||
                    error instanceof ProjectNotFoundError) {
                    throw error;
                }
                throw new ProjectOperationError(`Failed to get projects summary: ${error.message || error} :: Context: ${JSON.stringify(errorContext)}`);
            }
        });
    }
    // Performance monitoring services
    static getLogVolumeTrends() {
        return __awaiter(this, arguments, void 0, function* (options = {}) {
            try {
                const { projectId, startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), endDate = new Date(), granularity = "day", userId, } = options;
                const matchStage = {};
                matchStage.timestamp = {
                    $gte: startDate.toISOString(),
                    $lte: endDate.toISOString(),
                };
                if (projectId) {
                    matchStage.projectId = projectId;
                }
                else if (userId) {
                    // Get user's projects
                    const userProjects = yield project_model_1.ProjectModel.find({
                        $or: [
                            { ownerId: new mongoose_1.Types.ObjectId(userId) },
                            { "teamMembers.user": new mongoose_1.Types.ObjectId(userId) },
                        ],
                    })
                        .select("_id")
                        .lean();
                    const projectIds = userProjects.map((p) => p._id.toString());
                    if (projectIds.length > 0) {
                        matchStage.projectId = { $in: projectIds };
                    }
                    else {
                        // User has no projects
                        return {
                            timePoints: [],
                            metadata: {
                                timeRange: `${startDate.toISOString()} to ${endDate.toISOString()}`,
                                granularity,
                                totalDataPoints: 0,
                            },
                        };
                    }
                }
                let dateFormat;
                switch (granularity) {
                    case "hour":
                        dateFormat = "%Y-%m-%dT%H:00:00Z";
                        break;
                    case "day":
                        dateFormat = "%Y-%m-%d";
                        break;
                    case "week":
                        dateFormat = "%Y-W%U";
                        break;
                    case "month":
                        dateFormat = "%Y-%m";
                        break;
                    default:
                        dateFormat = "%Y-%m-%d";
                }
                const timePoints = yield log_model_1.LogModel.aggregate([
                    { $match: matchStage },
                    {
                        $group: {
                            _id: {
                                $dateToString: {
                                    format: dateFormat,
                                    date: { $toDate: "$timestamp" },
                                },
                            },
                            totalLogs: { $sum: 1 },
                            errorLogs: {
                                $sum: { $cond: [{ $eq: ["$level", "error"] }, 1, 0] },
                            },
                            warnLogs: {
                                $sum: { $cond: [{ $eq: ["$level", "warn"] }, 1, 0] },
                            },
                            infoLogs: {
                                $sum: { $cond: [{ $eq: ["$level", "info"] }, 1, 0] },
                            },
                            debugLogs: {
                                $sum: { $cond: [{ $eq: ["$level", "debug"] }, 1, 0] },
                            },
                        },
                    },
                    { $sort: { _id: 1 } },
                    {
                        $project: {
                            timestamp: "$_id",
                            totalLogs: 1,
                            errorLogs: 1,
                            warnLogs: 1,
                            infoLogs: 1,
                            debugLogs: 1,
                            _id: 0,
                        },
                    },
                ]);
                return {
                    timePoints,
                    metadata: {
                        timeRange: `${startDate.toISOString()} to ${endDate.toISOString()}`,
                        granularity,
                        totalDataPoints: timePoints.length,
                    },
                };
            }
            catch (error) {
                throw new ProjectOperationError(`Failed to get log volume trends: ${error}`, { options, originalError: error });
            }
        });
    }
    /**
     * Gets comprehensive error distribution analysis
     */
    static getErrorDistribution() {
        return __awaiter(this, arguments, void 0, function* (options = {}) {
            try {
                const { projectId, startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
                endDate = new Date(), userId, limit = 10, } = options;
                // Build base match stage
                const baseMatch = {
                    timestamp: {
                        $gte: startDate.toISOString(),
                        $lte: endDate.toISOString(),
                    },
                };
                // Handle project filtering
                if (projectId) {
                    baseMatch.projectId = projectId;
                }
                else if (userId) {
                    const userProjects = yield project_model_1.ProjectModel.find({
                        $or: [
                            { ownerId: new mongoose_1.Types.ObjectId(userId) },
                            { "teamMembers.user": new mongoose_1.Types.ObjectId(userId) },
                        ],
                    })
                        .select("_id")
                        .lean();
                    const projectIds = userProjects.map((p) => p._id.toString());
                    if (projectIds.length > 0) {
                        baseMatch.projectId = { $in: projectIds };
                    }
                }
                const [byLevel, byProject, byService, topErrorMessages] = yield Promise.all([
                    // Error distribution by level
                    log_model_1.LogModel.aggregate([
                        {
                            $match: Object.assign(Object.assign({}, baseMatch), { level: { $in: ["error", "warn", "fatal"] } }),
                        },
                        {
                            $group: {
                                _id: "$level",
                                count: { $sum: 1 },
                            },
                        },
                        {
                            $lookup: {
                                from: "logs",
                                pipeline: [{ $match: baseMatch }, { $count: "total" }],
                                as: "totalLogs",
                            },
                        },
                        {
                            $addFields: {
                                totalCount: { $arrayElemAt: ["$totalLogs.total", 0] },
                            },
                        },
                        {
                            $project: {
                                level: "$_id",
                                count: 1,
                                percentage: {
                                    $round: [
                                        {
                                            $multiply: [{ $divide: ["$count", "$totalCount"] }, 100],
                                        },
                                        2,
                                    ],
                                },
                                _id: 0,
                            },
                        },
                        { $sort: { count: -1 } },
                    ]),
                    // Error distribution by project
                    log_model_1.LogModel.aggregate([
                        {
                            $match: Object.assign(Object.assign({}, baseMatch), { level: { $in: ["error", "warn", "fatal"] } }),
                        },
                        {
                            $group: {
                                _id: "$projectId",
                                errorCount: { $sum: 1 },
                            },
                        },
                        {
                            $lookup: {
                                from: "logs",
                                let: { projectId: "$_id" },
                                pipeline: [
                                    {
                                        $match: {
                                            $expr: { $eq: ["$projectId", "$projectId"] },
                                            timestamp: {
                                                $gte: startDate.toISOString(),
                                                $lte: endDate.toISOString(),
                                            },
                                        },
                                    },
                                    { $count: "totalLogs" },
                                ],
                                as: "projectTotalLogs",
                            },
                        },
                        {
                            $lookup: {
                                from: "projects",
                                localField: "_id",
                                foreignField: "_id",
                                as: "projectInfo",
                                pipeline: [{ $project: { name: 1 } }],
                            },
                        },
                        {
                            $addFields: {
                                projectName: { $arrayElemAt: ["$projectInfo.name", 0] },
                                totalLogs: { $arrayElemAt: ["$projectTotalLogs.totalLogs", 0] },
                            },
                        },
                        {
                            $project: {
                                projectId: "$_id",
                                projectName: { $ifNull: ["$projectName", "Unknown Project"] },
                                errorCount: 1,
                                errorRate: {
                                    $round: [
                                        {
                                            $multiply: [
                                                {
                                                    $divide: [
                                                        "$errorCount",
                                                        { $ifNull: ["$totalLogs", 1] },
                                                    ],
                                                },
                                                100,
                                            ],
                                        },
                                        2,
                                    ],
                                },
                                _id: 0,
                            },
                        },
                        { $sort: { errorCount: -1 } },
                        { $limit: limit },
                    ]),
                    // Error distribution by service
                    log_model_1.LogModel.aggregate([
                        {
                            $match: Object.assign(Object.assign({}, baseMatch), { level: { $in: ["error", "warn", "fatal"] } }),
                        },
                        {
                            $group: {
                                _id: "$service",
                                errorCount: { $sum: 1 },
                                projects: { $addToSet: "$projectId" },
                            },
                        },
                        {
                            $project: {
                                service: { $ifNull: ["$_id", "unknown-service"] },
                                errorCount: 1,
                                projects: 1,
                                _id: 0,
                            },
                        },
                        { $sort: { errorCount: -1 } },
                        { $limit: limit },
                    ]),
                    // Top error messages
                    log_model_1.LogModel.aggregate([
                        {
                            $match: Object.assign(Object.assign({}, baseMatch), { level: { $in: ["error", "fatal"] }, "error.message": { $exists: true, $nin: [null, ""] } }),
                        },
                        {
                            $group: {
                                _id: "$error.message",
                                count: { $sum: 1 },
                                firstSeen: { $min: { $toDate: "$timestamp" } },
                                lastSeen: { $max: { $toDate: "$timestamp" } },
                                affectedProjects: { $addToSet: "$projectId" },
                            },
                        },
                        {
                            $project: {
                                message: "$_id",
                                count: 1,
                                firstSeen: 1,
                                lastSeen: 1,
                                affectedProjects: { $size: "$affectedProjects" },
                                _id: 0,
                            },
                        },
                        { $sort: { count: -1 } },
                        { $limit: limit },
                    ]),
                ]);
                return {
                    byLevel,
                    byProject,
                    byService,
                    topErrorMessages,
                };
            }
            catch (error) {
                throw new ProjectOperationError(`Failed to get error distribution: ${error}`, { options, originalError: error });
            }
        });
    }
    /**
     * Gets comprehensive project health data
     */
    static getProjectHealth(projectId_1) {
        return __awaiter(this, arguments, void 0, function* (projectId, options = {}) {
            try {
                this.validateObjectId(projectId);
                const { timeRange = 24, includeAlerts = true } = options;
                const startTime = new Date(Date.now() - timeRange * 60 * 60 * 1000);
                // Get project info
                const project = yield project_model_1.ProjectModel.findById(projectId)
                    .select("name createdAt lastIngestedAt isActive")
                    .lean();
                if (!project) {
                    throw new ProjectNotFoundError(projectId);
                }
                const [currentMetrics, historicalMetrics, responseTimeData, alertData] = yield Promise.all([
                    // Current metrics (last hour)
                    log_model_1.LogModel.aggregate([
                        {
                            $match: {
                                projectId,
                                timestamp: {
                                    $gte: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
                                },
                            },
                        },
                        {
                            $group: {
                                _id: null,
                                totalLogs: { $sum: 1 },
                                errorLogs: {
                                    $sum: { $cond: [{ $eq: ["$level", "error"] }, 1, 0] },
                                },
                                avgResponseTime: {
                                    $avg: {
                                        $cond: [
                                            { $type: "$data.responseTime" },
                                            "$data.responseTime",
                                            null,
                                        ],
                                    },
                                },
                            },
                        },
                    ]),
                    // Historical metrics for trend analysis
                    log_model_1.LogModel.aggregate([
                        {
                            $match: {
                                projectId,
                                timestamp: {
                                    $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                                },
                            },
                        },
                        {
                            $group: {
                                _id: {
                                    $dateToString: {
                                        format: "%Y-%m-%d",
                                        date: { $toDate: "$timestamp" },
                                    },
                                },
                                dailyLogs: { $sum: 1 },
                                dailyErrors: {
                                    $sum: { $cond: [{ $eq: ["$level", "error"] }, 1, 0] },
                                },
                            },
                        },
                        { $sort: { _id: 1 } },
                    ]),
                    // Response time data
                    log_model_1.LogModel.aggregate([
                        {
                            $match: {
                                projectId,
                                timestamp: { $gte: startTime.toISOString() },
                                "data.responseTime": { $exists: true, $type: "number" },
                            },
                        },
                        {
                            $group: {
                                _id: null,
                                responseTimes: { $push: "$data.responseTime" },
                                avgResponseTime: { $avg: "$data.responseTime" },
                            },
                        },
                        {
                            $project: {
                                avgResponseTime: { $round: ["$avgResponseTime", 2] },
                                p95: {
                                    $arrayElemAt: [
                                        "$responseTimes",
                                        {
                                            $floor: {
                                                $multiply: [{ $size: "$responseTimes" }, 0.95],
                                            },
                                        },
                                    ],
                                },
                                p99: {
                                    $arrayElemAt: [
                                        "$responseTimes",
                                        {
                                            $floor: {
                                                $multiply: [{ $size: "$responseTimes" }, 0.99],
                                            },
                                        },
                                    ],
                                },
                            },
                        },
                    ]),
                    // Alert conditions check (if enabled)
                    includeAlerts
                        ? this.generateProjectAlerts(projectId, timeRange)
                        : Promise.resolve([]),
                ]);
                // Calculate uptime
                const now = Date.now();
                const projectAge = now - new Date(project.createdAt || 0).getTime();
                const lastActivity = project.lastIngestedAt
                    ? now - new Date(project.lastIngestedAt).getTime()
                    : projectAge;
                const uptimePercentage = projectAge > 0
                    ? Math.max(0, Math.min(100, ((projectAge - lastActivity) / projectAge) * 100))
                    : 100;
                // Calculate error rate and trends
                const current = currentMetrics[0] || {
                    totalLogs: 0,
                    errorLogs: 0,
                    avgResponseTime: 0,
                };
                const errorRate = current.totalLogs > 0
                    ? (current.errorLogs / current.totalLogs) * 100
                    : 0;
                // Analyze trends
                const weeklyErrorRates = historicalMetrics.map((day) => day.dailyLogs > 0 ? (day.dailyErrors / day.dailyLogs) * 100 : 0);
                const weeklyAverage = weeklyErrorRates.length > 0
                    ? weeklyErrorRates.reduce((a, b) => a + b, 0) /
                        weeklyErrorRates.length
                    : 0;
                let errorTrend = "stable";
                if (weeklyErrorRates.length >= 2) {
                    const recent = weeklyErrorRates.slice(-3).reduce((a, b) => a + b, 0) / 3;
                    const older = weeklyErrorRates.slice(0, -3).reduce((a, b) => a + b, 0) /
                        Math.max(1, weeklyErrorRates.length - 3);
                    if (recent > older * 1.2)
                        errorTrend = "increasing";
                    else if (recent < older * 0.8)
                        errorTrend = "decreasing";
                }
                // Response time analysis
                const responseTimeMetrics = responseTimeData[0] || {
                    avgResponseTime: 0,
                    p95: 0,
                    p99: 0,
                };
                // Determine health status
                let healthStatus = "healthy";
                if (errorRate > 10 || responseTimeMetrics.avgResponseTime > 5000) {
                    healthStatus = "critical";
                }
                else if (errorRate > 5 ||
                    responseTimeMetrics.avgResponseTime > 2000 ||
                    uptimePercentage < 95) {
                    healthStatus = "warning";
                }
                return {
                    projectId,
                    projectName: project.name,
                    uptime: {
                        percentage: Math.round(uptimePercentage * 100) / 100,
                        totalTime: projectAge,
                        downtime: lastActivity,
                        lastIncident: lastActivity > 60 * 60 * 1000 ? new Date(now - lastActivity) : null,
                    },
                    errorRate: {
                        current: Math.round(errorRate * 100) / 100,
                        trend: errorTrend,
                        weeklyAverage: Math.round(weeklyAverage * 100) / 100,
                    },
                    responseTime: {
                        current: responseTimeMetrics.avgResponseTime,
                        p95: responseTimeMetrics.p95 || 0,
                        p99: responseTimeMetrics.p99 || 0,
                        trend: "stable", // Could be enhanced with historical comparison
                    },
                    healthStatus,
                    lastHealthCheck: new Date(),
                    alerts: alertData,
                };
            }
            catch (error) {
                if (error instanceof ProjectNotFoundError) {
                    throw error;
                }
                throw new ProjectOperationError(`Failed to get project health: ${error}`, { projectId, options, originalError: error });
            }
        });
    }
    /**
     * Gets log levels distribution
     */
    static getLogLevelsDistribution() {
        return __awaiter(this, arguments, void 0, function* (options = {}) {
            try {
                const { projectId, startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), endDate = new Date(), userId, } = options;
                // Build match stage
                const matchStage = {
                    timestamp: {
                        $gte: startDate.toISOString(),
                        $lte: endDate.toISOString(),
                    },
                };
                if (projectId) {
                    matchStage.projectId = projectId;
                }
                else if (userId) {
                    const userProjects = yield project_model_1.ProjectModel.find({
                        $or: [
                            { ownerId: new mongoose_1.Types.ObjectId(userId) },
                            { "teamMembers.user": new mongoose_1.Types.ObjectId(userId) },
                        ],
                    })
                        .select("_id")
                        .lean();
                    const projectIds = userProjects.map((p) => p._id.toString());
                    if (projectIds.length > 0) {
                        matchStage.projectId = { $in: projectIds };
                    }
                }
                const [distribution, timeline, totalCount] = yield Promise.all([
                    // Current distribution
                    log_model_1.LogModel.aggregate([
                        { $match: matchStage },
                        {
                            $group: {
                                _id: "$level",
                                count: { $sum: 1 },
                            },
                        },
                        { $sort: { count: -1 } },
                    ]),
                    // Timeline data for trends
                    log_model_1.LogModel.aggregate([
                        { $match: matchStage },
                        {
                            $group: {
                                _id: {
                                    date: {
                                        $dateToString: {
                                            format: "%Y-%m-%d",
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
                                _id: "$_id.date",
                                levels: {
                                    $push: {
                                        k: "$_id.level",
                                        v: "$count",
                                    },
                                },
                            },
                        },
                        {
                            $project: {
                                timestamp: "$_id",
                                levels: { $arrayToObject: "$levels" },
                                _id: 0,
                            },
                        },
                        { $sort: { timestamp: 1 } },
                    ]),
                    // Total count
                    log_model_1.LogModel.countDocuments(matchStage),
                ]);
                // Calculate percentages and trends
                const distributionWithPercentages = distribution.map((item) => {
                    const percentage = totalCount > 0 ? (item.count / totalCount) * 100 : 0;
                    return {
                        level: item._id,
                        count: item.count,
                        percentage: Math.round(percentage * 100) / 100,
                        trend: "stable", // Could be enhanced with historical comparison
                    };
                });
                const dominantLevel = distributionWithPercentages.length > 0
                    ? distributionWithPercentages[0].level
                    : "unknown";
                return {
                    distribution: distributionWithPercentages,
                    timeline,
                    metadata: {
                        totalLogs: totalCount,
                        timeRange: `${startDate.toISOString()} to ${endDate.toISOString()}`,
                        dominantLevel,
                    },
                };
            }
            catch (error) {
                throw new ProjectOperationError(`Failed to get log levels distribution: ${error}`, { options, originalError: error });
            }
        });
    }
    /**
     * Gets response time trends
     */
    static getResponseTimeTrends() {
        return __awaiter(this, arguments, void 0, function* (options = {}) {
            try {
                const { projectId, startDate = new Date(Date.now() - 24 * 60 * 60 * 1000), endDate = new Date(), granularity = "hour", userId, } = options;
                // Build match stage
                const matchStage = {
                    timestamp: {
                        $gte: startDate.toISOString(),
                        $lte: endDate.toISOString(),
                    },
                    "data.responseTime": { $exists: true, $type: "number" },
                };
                if (projectId) {
                    matchStage.projectId = projectId;
                }
                else if (userId) {
                    const userProjects = yield project_model_1.ProjectModel.find({
                        $or: [
                            { ownerId: new mongoose_1.Types.ObjectId(userId) },
                            { "teamMembers.user": new mongoose_1.Types.ObjectId(userId) },
                        ],
                    })
                        .select("_id")
                        .lean();
                    const projectIds = userProjects.map((p) => p._id.toString());
                    if (projectIds.length > 0) {
                        matchStage.projectId = { $in: projectIds };
                    }
                }
                const dateFormat = granularity === "hour" ? "%Y-%m-%dT%H:00:00Z" : "%Y-%m-%d";
                const [trendsData, summaryData] = yield Promise.all([
                    // Trends data
                    log_model_1.LogModel.aggregate([
                        { $match: matchStage },
                        {
                            $group: {
                                _id: {
                                    $dateToString: {
                                        format: dateFormat,
                                        date: { $toDate: "$timestamp" },
                                    },
                                },
                                responseTimes: { $push: "$data.responseTime" },
                                avgResponseTime: { $avg: "$data.responseTime" },
                                requestCount: { $sum: 1 },
                            },
                        },
                        {
                            $addFields: {
                                sortedTimes: {
                                    $sortArray: { input: "$responseTimes", sortBy: 1 },
                                },
                            },
                        },
                        {
                            $project: {
                                timestamp: "$_id",
                                avgResponseTime: { $round: ["$avgResponseTime", 2] },
                                requestCount: 1,
                                p50: {
                                    $arrayElemAt: [
                                        "$sortedTimes",
                                        { $floor: { $multiply: [{ $size: "$sortedTimes" }, 0.5] } },
                                    ],
                                },
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
                                _id: 0,
                            },
                        },
                        { $sort: { timestamp: 1 } },
                    ]),
                    // Summary data
                    log_model_1.LogModel.aggregate([
                        { $match: matchStage },
                        {
                            $group: {
                                _id: null,
                                overallAvg: { $avg: "$data.responseTime" },
                                bestTime: { $min: "$data.responseTime" },
                                worstTime: { $max: "$data.responseTime" },
                                responseTimes: { $push: "$data.responseTime" },
                            },
                        },
                    ]),
                ]);
                // Calculate trend
                let trend = "stable";
                if (trendsData.length >= 2) {
                    const recent = trendsData
                        .slice(-3)
                        .reduce((sum, item) => sum + item.avgResponseTime, 0) / 3;
                    const older = trendsData
                        .slice(0, -3)
                        .reduce((sum, item) => sum + item.avgResponseTime, 0) /
                        Math.max(1, trendsData.length - 3);
                    if (recent < older * 0.9)
                        trend = "improving";
                    else if (recent > older * 1.1)
                        trend = "degrading";
                }
                const summary = summaryData[0] || {
                    overallAvg: 0,
                    bestTime: 0,
                    worstTime: 0,
                };
                return {
                    trends: trendsData,
                    summary: {
                        overallAvg: Math.round(summary.overallAvg * 100) / 100,
                        bestTime: summary.bestTime,
                        worstTime: summary.worstTime,
                        trend,
                    },
                };
            }
            catch (error) {
                throw new ProjectOperationError(`Failed to get response time trends: ${error}`, { options, originalError: error });
            }
        });
    }
    /**
     * Gets top error sources with detailed information
     */
    static getTopErrorSources() {
        return __awaiter(this, arguments, void 0, function* (options = {}) {
            try {
                const { projectId, startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), endDate = new Date(), userId, limit = 10, groupBy = "url", } = options;
                // Build match stage
                const matchStage = {
                    timestamp: {
                        $gte: startDate.toISOString(),
                        $lte: endDate.toISOString(),
                    },
                    level: { $in: ["error", "fatal"] },
                    [groupBy]: { $exists: true, $nin: [null, ""] },
                };
                if (projectId) {
                    matchStage.projectId = projectId;
                }
                else if (userId) {
                    const userProjects = yield project_model_1.ProjectModel.find({
                        $or: [
                            { ownerId: new mongoose_1.Types.ObjectId(userId) },
                            { "teamMembers.user": new mongoose_1.Types.ObjectId(userId) },
                        ],
                    })
                        .select("_id")
                        .lean();
                    const projectIds = userProjects.map((p) => p._id.toString());
                    if (projectIds.length > 0) {
                        matchStage.projectId = { $in: projectIds };
                    }
                }
                const [sources, totalErrors] = yield Promise.all([
                    log_model_1.LogModel.aggregate([
                        { $match: matchStage },
                        {
                            $group: {
                                _id: `${groupBy}`,
                                count: { $sum: 1 },
                                firstSeen: { $min: { $toDate: "$timestamp" } },
                                lastSeen: { $max: { $toDate: "$timestamp" } },
                                affectedProjects: { $addToSet: "$projectId" },
                                errorTypes: {
                                    $push: {
                                        $ifNull: ["$error.name", "$level"],
                                    },
                                },
                            },
                        },
                        {
                            $addFields: {
                                errorTypesCounted: {
                                    $reduce: {
                                        input: "$errorTypes",
                                        initialValue: [],
                                        in: {
                                            $let: {
                                                vars: {
                                                    existing: {
                                                        $filter: {
                                                            input: "$value",
                                                            cond: { $eq: ["$this.type", "$item"] },
                                                        },
                                                    },
                                                },
                                                in: {
                                                    $cond: [
                                                        { $gt: [{ $size: "$existing" }, 0] },
                                                        {
                                                            $map: {
                                                                input: "$value",
                                                                in: {
                                                                    $cond: [
                                                                        { $eq: ["$this.type", "$item"] },
                                                                        {
                                                                            type: "$this.type",
                                                                            count: { $add: ["$this.count", 1] },
                                                                        },
                                                                        "$this",
                                                                    ],
                                                                },
                                                            },
                                                        },
                                                        {
                                                            $concatArrays: [
                                                                "$value",
                                                                [{ type: "$item", count: 1 }],
                                                            ],
                                                        },
                                                    ],
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        {
                            $project: {
                                source: "$_id",
                                count: 1,
                                firstSeen: 1,
                                lastSeen: 1,
                                affectedProjects: { $size: "$affectedProjects" },
                                errorTypes: "$errorTypesCounted",
                                _id: 0,
                            },
                        },
                        { $sort: { count: -1 } },
                        { $limit: limit },
                    ]),
                    log_model_1.LogModel.countDocuments(matchStage),
                ]);
                // Add percentages and trends
                const sourcesWithMetadata = sources.map((source) => (Object.assign(Object.assign({}, source), { percentage: totalErrors > 0
                        ? Math.round((source.count / totalErrors) * 10000) / 100
                        : 0, trend: "stable" })));
                return {
                    sources: sourcesWithMetadata,
                    metadata: {
                        totalErrors,
                        timeRange: `${startDate.toISOString()} to ${endDate.toISOString()}`,
                        groupedBy: groupBy,
                    },
                };
            }
            catch (error) {
                throw new ProjectOperationError(`Failed to get top error sources: ${error}`, { options, originalError: error });
            }
        });
    }
    /**
     * Gets service performance metrics
     */
    static getServicePerformance() {
        return __awaiter(this, arguments, void 0, function* (options = {}) {
            try {
                const { projectId, serviceName, startDate = new Date(Date.now() - 24 * 60 * 60 * 1000), endDate = new Date(), userId, } = options;
                // Build match stage
                const matchStage = {
                    timestamp: {
                        $gte: startDate.toISOString(),
                        $lte: endDate.toISOString(),
                    },
                    service: { $exists: true, $nin: [null, ""] },
                };
                if (projectId) {
                    matchStage.projectId = projectId;
                }
                else if (userId) {
                    const userProjects = yield project_model_1.ProjectModel.find({
                        $or: [
                            { ownerId: new mongoose_1.Types.ObjectId(userId) },
                            { "teamMembers.user": new mongoose_1.Types.ObjectId(userId) },
                        ],
                    })
                        .select("_id")
                        .lean();
                    const projectIds = userProjects.map((p) => p._id.toString());
                    if (projectIds.length > 0) {
                        matchStage.projectId = { $in: projectIds };
                    }
                }
                if (serviceName) {
                    matchStage.service = serviceName;
                }
                const servicesData = yield log_model_1.LogModel.aggregate([
                    { $match: matchStage },
                    {
                        $group: {
                            _id: "$service",
                            requestCount: { $sum: 1 },
                            errorCount: {
                                $sum: { $cond: [{ $in: ["$level", ["error", "fatal"]] }, 1, 0] },
                            },
                            responseTimes: {
                                $push: {
                                    $cond: [
                                        { $type: "$data.responseTime" },
                                        "$data.responseTime",
                                        null,
                                    ],
                                },
                            },
                            hourlyData: {
                                $push: {
                                    hour: {
                                        $dateToString: {
                                            format: "%Y-%m-%dT%H:00:00Z",
                                            date: { $toDate: "$timestamp" },
                                        },
                                    },
                                    responseTime: {
                                        $cond: [
                                            { $type: "$data.responseTime" },
                                            "$data.responseTime",
                                            null,
                                        ],
                                    },
                                    isError: { $in: ["$level", ["error", "fatal"]] },
                                    url: "$url",
                                },
                            },
                        },
                    },
                    {
                        $addFields: {
                            validResponseTimes: {
                                $filter: {
                                    input: "$responseTimes",
                                    cond: { $ne: ["$this", null] },
                                },
                            },
                        },
                    },
                    {
                        $project: {
                            serviceName: "$_id",
                            metrics: {
                                requestCount: "$requestCount",
                                errorCount: "$errorCount",
                                averageResponseTime: {
                                    $cond: [
                                        { $gt: [{ $size: "$validResponseTimes" }, 0] },
                                        { $avg: "$validResponseTimes" },
                                        0,
                                    ],
                                },
                                throughput: {
                                    $divide: [
                                        "$requestCount",
                                        {
                                            $divide: [
                                                { $subtract: [endDate, startDate] },
                                                1000 * 60 * 60,
                                            ],
                                        },
                                    ],
                                },
                                availability: {
                                    $multiply: [
                                        {
                                            $subtract: [
                                                1,
                                                { $divide: ["$errorCount", "$requestCount"] },
                                            ],
                                        },
                                        100,
                                    ],
                                },
                            },
                            hourlyData: 1,
                            _id: 0,
                        },
                    },
                    { $sort: { "metrics.requestCount": -1 } },
                ]);
                // Process hourly data for trends
                const processedServices = servicesData.map((service) => {
                    // Group hourly data
                    const hourlyGroups = service.hourlyData.reduce((acc, item) => {
                        if (!acc[item.hour]) {
                            acc[item.hour] = { responseTimes: [], errors: 0, total: 0 };
                        }
                        acc[item.hour].total += 1;
                        if (item.isError)
                            acc[item.hour].errors += 1;
                        if (item.responseTime)
                            acc[item.hour].responseTimes.push(item.responseTime);
                        return acc;
                    }, {});
                    // Generate trends
                    const trends = {
                        responseTime: Object.entries(hourlyGroups).map(([timestamp, data]) => ({
                            timestamp,
                            value: data.responseTimes.length > 0
                                ? data.responseTimes.reduce((a, b) => a + b, 0) / data.responseTimes.length
                                : 0,
                        })),
                        errorRate: Object.entries(hourlyGroups).map(([timestamp, data]) => ({
                            timestamp,
                            value: data.total > 0 ? (data.errors / data.total) * 100 : 0,
                        })),
                    };
                    // Get top endpoints
                    const endpointCounts = service.hourlyData.reduce((acc, item) => {
                        if (item.url) {
                            if (!acc[item.url]) {
                                acc[item.url] = { hits: 0, responseTimes: [], errors: 0 };
                            }
                            acc[item.url].hits += 1;
                            if (item.responseTime)
                                acc[item.url].responseTimes.push(item.responseTime);
                            if (item.isError)
                                acc[item.url].errors += 1;
                        }
                        return acc;
                    }, {});
                    const topEndpoints = Object.entries(endpointCounts)
                        .map(([endpoint, data]) => ({
                        endpoint,
                        hitCount: data.hits,
                        avgResponseTime: data.responseTimes.length > 0
                            ? Math.round(data.responseTimes.reduce((a, b) => a + b, 0) / data.responseTimes.length)
                            : 0,
                        errorRate: data.hits > 0
                            ? Math.round((data.errors / data.hits) * 10000) / 100
                            : 0,
                    }))
                        .sort((a, b) => b.hitCount - a.hitCount)
                        .slice(0, 5);
                    return {
                        serviceName: service.serviceName,
                        metrics: Object.assign(Object.assign({}, service.metrics), { averageResponseTime: Math.round(service.metrics.averageResponseTime), throughput: Math.round(service.metrics.throughput * 100) / 100, availability: Math.round(service.metrics.availability * 100) / 100 }),
                        trends,
                        topEndpoints,
                    };
                });
                return processedServices;
            }
            catch (error) {
                throw new ProjectOperationError(`Failed to get service performance: ${error}`, { options, originalError: error });
            }
        });
    }
    /**
     * Gets comprehensive usage statistics
     */
    static getUsageStatistics() {
        return __awaiter(this, arguments, void 0, function* (options = {}) {
            try {
                const { startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), endDate = new Date(), userId, includeUserBreakdown = false, } = options;
                // Build filters
                const logMatchStage = {
                    timestamp: {
                        $gte: startDate.toISOString(),
                        $lte: endDate.toISOString(),
                    },
                };
                const projectMatchStage = {};
                if (userId) {
                    projectMatchStage.$or = [
                        { ownerId: new mongoose_1.Types.ObjectId(userId) },
                        { "teamMembers.user": new mongoose_1.Types.ObjectId(userId) },
                    ];
                    // Get user's projects for log filtering
                    const userProjects = yield project_model_1.ProjectModel.find(projectMatchStage)
                        .select("_id")
                        .lean();
                    const projectIds = userProjects.map((p) => p._id.toString());
                    if (projectIds.length > 0) {
                        logMatchStage.projectId = { $in: projectIds };
                    }
                }
                const [overviewData, dailyApiCalls, projectGrowth, userActivity, topProjects, topUsers,] = yield Promise.all([
                    // Overview statistics
                    Promise.all([
                        log_model_1.LogModel.countDocuments(logMatchStage), // Total API calls (logs)
                        project_model_1.ProjectModel.countDocuments(projectMatchStage), // Total projects
                        project_model_1.ProjectModel.distinct("ownerId", projectMatchStage).then((owners) => owners.length), // Active users
                        log_model_1.LogModel.aggregate([
                            { $match: logMatchStage },
                            {
                                $group: {
                                    _id: null,
                                    totalSize: {
                                        $sum: {
                                            $add: [
                                                { $strLenCP: { $ifNull: ["$message", ""] } },
                                                100, // Estimated overhead per log
                                            ],
                                        },
                                    },
                                },
                            },
                        ]).then((result) => { var _a; return ((_a = result[0]) === null || _a === void 0 ? void 0 : _a.totalSize) || 0; }),
                    ]),
                    // Daily API calls trend
                    log_model_1.LogModel.aggregate([
                        { $match: logMatchStage },
                        {
                            $group: {
                                _id: {
                                    $dateToString: {
                                        format: "%Y-%m-%d",
                                        date: { $toDate: "$timestamp" },
                                    },
                                },
                                count: { $sum: 1 },
                            },
                        },
                        { $sort: { _id: 1 } },
                        {
                            $project: {
                                date: "$_id",
                                count: 1,
                                _id: 0,
                            },
                        },
                    ]),
                    // Project growth trend
                    project_model_1.ProjectModel.aggregate([
                        {
                            $match: Object.assign(Object.assign({}, projectMatchStage), { createdAt: {
                                    $gte: startDate,
                                    $lte: endDate,
                                } }),
                        },
                        {
                            $group: {
                                _id: {
                                    $dateToString: {
                                        format: "%Y-%m-%d",
                                        date: "$createdAt",
                                    },
                                },
                                count: { $sum: 1 },
                            },
                        },
                        { $sort: { _id: 1 } },
                        {
                            $project: {
                                date: "$_id",
                                count: 1,
                                _id: 0,
                            },
                        },
                    ]),
                    // User activity (projects with recent logs)
                    log_model_1.LogModel.aggregate([
                        { $match: logMatchStage },
                        {
                            $group: {
                                _id: {
                                    date: {
                                        $dateToString: {
                                            format: "%Y-%m-%d",
                                            date: { $toDate: "$timestamp" },
                                        },
                                    },
                                    projectId: "$projectId",
                                },
                            },
                        },
                        {
                            $lookup: {
                                from: "projects",
                                localField: "_id.projectId",
                                foreignField: "_id",
                                as: "project",
                            },
                        },
                        { $unwind: "$project" },
                        {
                            $group: {
                                _id: {
                                    date: "$_id.date",
                                    userId: "$project.ownerId",
                                },
                            },
                        },
                        {
                            $group: {
                                _id: "$_id.date",
                                activeUsers: { $sum: 1 },
                            },
                        },
                        { $sort: { _id: 1 } },
                        {
                            $project: {
                                date: "$_id",
                                activeUsers: 1,
                                _id: 0,
                            },
                        },
                    ]),
                    // Top consuming projects
                    log_model_1.LogModel.aggregate([
                        { $match: logMatchStage },
                        {
                            $group: {
                                _id: "$projectId",
                                apiCalls: { $sum: 1 },
                                dataUsage: {
                                    $sum: {
                                        $add: [{ $strLenCP: { $ifNull: ["$message", ""] } }, 100],
                                    },
                                },
                            },
                        },
                        {
                            $lookup: {
                                from: "projects",
                                localField: "_id",
                                foreignField: "_id",
                                as: "project",
                            },
                        },
                        { $unwind: "$project" },
                        {
                            $project: {
                                projectId: "$_id",
                                projectName: "$project.name",
                                apiCalls: 1,
                                dataUsage: {
                                    $round: [{ $divide: ["$dataUsage", 1024 * 1024] }, 2],
                                }, // Convert to MB
                                _id: 0,
                            },
                        },
                        { $sort: { apiCalls: -1 } },
                        { $limit: 10 },
                    ]),
                    // Top users (if breakdown is enabled)
                    includeUserBreakdown
                        ? log_model_1.LogModel.aggregate([
                            { $match: logMatchStage },
                            {
                                $lookup: {
                                    from: "projects",
                                    localField: "projectId",
                                    foreignField: "_id",
                                    as: "project",
                                },
                            },
                            { $unwind: "$project" },
                            {
                                $group: {
                                    _id: "$project.ownerId",
                                    totalApiCalls: { $sum: 1 },
                                    projects: { $addToSet: "$project._id" },
                                },
                            },
                            {
                                $lookup: {
                                    from: "users",
                                    localField: "_id",
                                    foreignField: "_id",
                                    as: "user",
                                },
                            },
                            { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
                            {
                                $project: {
                                    userId: "$_id",
                                    userName: {
                                        $ifNull: [
                                            { $concat: ["$user.firstName", " ", "$user.lastName"] },
                                            "Unknown User",
                                        ],
                                    },
                                    projectsOwned: { $size: "$projects" },
                                    totalApiCalls: 1,
                                    _id: 0,
                                },
                            },
                            { $sort: { totalApiCalls: -1 } },
                            { $limit: 10 },
                        ])
                        : Promise.resolve([]),
                ]);
                const [totalApiCalls, totalProjects, activeUsers, dataIngested] = overviewData;
                return {
                    overview: {
                        totalApiCalls,
                        totalProjects,
                        activeUsers,
                        dataIngested: Math.round((dataIngested / (1024 * 1024)) * 100) / 100, // Convert to MB
                    },
                    trends: {
                        dailyApiCalls,
                        projectGrowth,
                        userActivity,
                    },
                    topConsumers: {
                        projects: topProjects,
                        users: topUsers,
                    },
                };
            }
            catch (error) {
                throw new ProjectOperationError(`Failed to get usage statistics: ${error}`, { options, originalError: error });
            }
        });
    }
    /**
     * Helper method to generate project alerts
     */
    static generateProjectAlerts(projectId_1) {
        return __awaiter(this, arguments, void 0, function* (projectId, timeRangeHours = 24) {
            var _a;
            try {
                const alerts = [];
                const startTime = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000);
                // Check error rate
                const [totalLogs, errorLogs] = yield Promise.all([
                    log_model_1.LogModel.countDocuments({
                        projectId,
                        timestamp: { $gte: startTime.toISOString() },
                    }),
                    log_model_1.LogModel.countDocuments({
                        projectId,
                        level: "error",
                        timestamp: { $gte: startTime.toISOString() },
                    }),
                ]);
                const errorRate = totalLogs > 0 ? (errorLogs / totalLogs) * 100 : 0;
                if (errorRate > 15) {
                    alerts.push({
                        type: "error_rate",
                        severity: "high",
                        message: `Error rate is critically high at ${errorRate.toFixed(2)}%`,
                        timestamp: new Date(),
                    });
                }
                else if (errorRate > 10) {
                    alerts.push({
                        type: "error_rate",
                        severity: "medium",
                        message: `Error rate is elevated at ${errorRate.toFixed(2)}%`,
                        timestamp: new Date(),
                    });
                }
                else if (errorRate > 5) {
                    alerts.push({
                        type: "error_rate",
                        severity: "low",
                        message: `Error rate is above normal at ${errorRate.toFixed(2)}%`,
                        timestamp: new Date(),
                    });
                }
                // Check response time
                const responseTimeData = yield log_model_1.LogModel.aggregate([
                    {
                        $match: {
                            projectId,
                            timestamp: { $gte: startTime.toISOString() },
                            "data.responseTime": { $exists: true, $type: "number" },
                        },
                    },
                    {
                        $group: {
                            _id: null,
                            avgResponseTime: { $avg: "$data.responseTime" },
                        },
                    },
                ]);
                const avgResponseTime = ((_a = responseTimeData[0]) === null || _a === void 0 ? void 0 : _a.avgResponseTime) || 0;
                if (avgResponseTime > 5000) {
                    alerts.push({
                        type: "response_time",
                        severity: "high",
                        message: `Average response time is critically slow at ${Math.round(avgResponseTime)}ms`,
                        timestamp: new Date(),
                    });
                }
                else if (avgResponseTime > 2000) {
                    alerts.push({
                        type: "response_time",
                        severity: "medium",
                        message: `Average response time is elevated at ${Math.round(avgResponseTime)}ms`,
                        timestamp: new Date(),
                    });
                }
                // Check uptime (based on log activity)
                const project = yield project_model_1.ProjectModel.findById(projectId)
                    .select("lastIngestedAt")
                    .lean();
                if (project === null || project === void 0 ? void 0 : project.lastIngestedAt) {
                    const lastActivityHours = (Date.now() - new Date(project.lastIngestedAt).getTime()) /
                        (1000 * 60 * 60);
                    if (lastActivityHours > 24) {
                        alerts.push({
                            type: "uptime",
                            severity: "high",
                            message: `No activity detected for ${Math.round(lastActivityHours)} hours`,
                            timestamp: new Date(),
                        });
                    }
                    else if (lastActivityHours > 6) {
                        alerts.push({
                            type: "uptime",
                            severity: "medium",
                            message: `Reduced activity detected - last log ${Math.round(lastActivityHours)} hours ago`,
                            timestamp: new Date(),
                        });
                    }
                }
                return alerts;
            }
            catch (error) {
                console.warn("Failed to generate project alerts:", error);
                return [];
            }
        });
    }
}
exports.ProjectService = ProjectService;
