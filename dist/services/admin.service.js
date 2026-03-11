"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const user_model_1 = require("../models/user.model");
const project_model_1 = require("../models/project.model");
const log_model_1 = require("../models/log.model");
const organization_model_1 = require("../models/organization.model");
// ============================================
// SERVICE
// ============================================
class AdminService {
    /**
     * Get user and growth KPIs.
     */
    static async getUserStats() {
        const now = new Date();
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);
        const startOfWeek = new Date(now);
        startOfWeek.setDate(startOfWeek.getDate() - 7);
        const startOfMonth = new Date(now);
        startOfMonth.setDate(startOfMonth.getDate() - 30);
        const [totalUsers, newThisWeek, newThisMonth, activeUsersToday, totalOrganizations, newOrgsThisWeek,] = await Promise.all([
            user_model_1.UserModel.countDocuments(),
            user_model_1.UserModel.countDocuments({ joinedAt: { $gte: startOfWeek } }),
            user_model_1.UserModel.countDocuments({ joinedAt: { $gte: startOfMonth } }),
            // Estimate active users: users who joined today or have recent activity
            // Since we don't track last login, we use joinedAt + updatedAt as proxy
            user_model_1.UserModel.countDocuments({
                $or: [
                    { joinedAt: { $gte: startOfToday } },
                    { updatedAt: { $gte: startOfToday } },
                ],
            }),
            organization_model_1.OrganizationModel.countDocuments(),
            organization_model_1.OrganizationModel.countDocuments({ createdAt: { $gte: startOfWeek } }),
        ]);
        return {
            totalUsers,
            newThisWeek,
            newThisMonth,
            activeUsersToday,
            totalOrganizations,
            newOrgsThisWeek,
        };
    }
    /**
     * Get usage KPIs (logs, projects, volumes).
     */
    static async getUsageStats() {
        const now = new Date();
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);
        const startOfWeek = new Date(now);
        startOfWeek.setDate(startOfWeek.getDate() - 7);
        const startOfMonth = new Date(now);
        startOfMonth.setDate(startOfMonth.getDate() - 30);
        const [totalLogs, logsToday, logsThisWeek, logsThisMonth, totalProjects, activeProjects, topProjectsAgg,] = await Promise.all([
            log_model_1.LogModel.countDocuments(),
            log_model_1.LogModel.countDocuments({ createdAt: { $gte: startOfToday } }),
            log_model_1.LogModel.countDocuments({ createdAt: { $gte: startOfWeek } }),
            log_model_1.LogModel.countDocuments({ createdAt: { $gte: startOfMonth } }),
            project_model_1.ProjectModel.countDocuments(),
            // Active projects: those with logs in the last 7 days
            project_model_1.ProjectModel.countDocuments({ lastIngestedAt: { $gte: startOfWeek } }),
            // Top 10 projects by log count
            project_model_1.ProjectModel.aggregate([
                { $match: { logCount: { $gt: 0 } } },
                { $sort: { logCount: -1 } },
                { $limit: 10 },
                {
                    $project: {
                        projectId: { $toString: "$_id" },
                        name: 1,
                        logCount: 1,
                    },
                },
            ]),
        ]);
        const avgLogsPerProject = totalProjects > 0 ? Math.round(totalLogs / totalProjects) : 0;
        return {
            totalLogs,
            logsToday,
            logsThisWeek,
            logsThisMonth,
            totalProjects,
            activeProjects,
            avgLogsPerProject,
            topProjectsByVolume: topProjectsAgg.map((p) => ({
                projectId: p.projectId,
                name: p.name,
                logCount: p.logCount || 0,
            })),
        };
    }
    /**
     * Get system health information.
     */
    static async getSystemHealth() {
        let mongoStatus = "disconnected";
        let connections = 0;
        let dbSize = 0;
        try {
            const mongoState = mongoose_1.default.connection.readyState;
            mongoStatus =
                mongoState === 1
                    ? "connected"
                    : mongoState === 2
                        ? "connecting"
                        : mongoState === 3
                            ? "disconnecting"
                            : "disconnected";
            if (mongoState === 1 && mongoose_1.default.connection.db) {
                const adminDb = mongoose_1.default.connection.db.admin();
                const serverStatus = await adminDb.serverStatus();
                connections = serverStatus?.connections?.current || 0;
                const dbStats = await mongoose_1.default.connection.db.stats();
                dbSize = dbStats?.dataSize || 0;
            }
        }
        catch (err) {
            // If we can't get extended stats (e.g. Atlas restrictions), provide basics
            mongoStatus =
                mongoose_1.default.connection.readyState === 1 ? "connected" : "disconnected";
        }
        return {
            mongodb: {
                status: mongoStatus,
                connections,
                dbSize,
            },
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            nodeVersion: process.version,
        };
    }
    /**
     * Get usage trends over a given number of days.
     * Returns daily aggregated logs, errors, and new users.
     */
    static async getUsageTrends(days) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        startDate.setHours(0, 0, 0, 0);
        // Aggregate logs per day
        const logTrendsPromise = log_model_1.LogModel.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate },
                },
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
                    },
                    logs: { $sum: 1 },
                    errors: {
                        $sum: {
                            $cond: [
                                { $in: ["$level", ["error", "fatal"]] },
                                1,
                                0,
                            ],
                        },
                    },
                },
            },
            { $sort: { _id: 1 } },
        ]);
        // Aggregate new users per day
        const userTrendsPromise = user_model_1.UserModel.aggregate([
            {
                $match: {
                    joinedAt: { $gte: startDate },
                },
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$joinedAt" },
                    },
                    users: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]);
        const [logTrends, userTrends] = await Promise.all([
            logTrendsPromise,
            userTrendsPromise,
        ]);
        // Build a map of all dates in the range
        const dateMap = new Map();
        for (let i = 0; i <= days; i++) {
            const d = new Date(startDate);
            d.setDate(d.getDate() + i);
            const key = d.toISOString().split("T")[0];
            dateMap.set(key, { date: key, logs: 0, errors: 0, users: 0 });
        }
        // Merge log trends
        for (const entry of logTrends) {
            const point = dateMap.get(entry._id);
            if (point) {
                point.logs = entry.logs;
                point.errors = entry.errors;
            }
        }
        // Merge user trends
        for (const entry of userTrends) {
            const point = dateMap.get(entry._id);
            if (point) {
                point.users = entry.users;
            }
        }
        return Array.from(dateMap.values());
    }
    /**
     * List users with pagination and search.
     */
    static async listUsers(params) {
        const { page, limit, search, role } = params;
        const skip = (page - 1) * limit;
        const filter = {};
        if (search) {
            const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            filter.$or = [
                { firstName: { $regex: escaped, $options: "i" } },
                { lastName: { $regex: escaped, $options: "i" } },
                { email: { $regex: escaped, $options: "i" } },
            ];
        }
        if (role && role !== "all") {
            filter.role = role;
        }
        const [users, total] = await Promise.all([
            user_model_1.UserModel.find(filter)
                .select("-password -mfaSecret -mfaBackupCodes -accessToken -refreshToken -resetPasswordToken")
                .sort({ joinedAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            user_model_1.UserModel.countDocuments(filter),
        ]);
        return { users, total };
    }
    /**
     * Update a user's role.
     */
    static async updateUserRole(userId, role) {
        if (!["developer", "admin"].includes(role)) {
            throw new Error("Invalid role. Must be 'developer' or 'admin'.");
        }
        const user = await user_model_1.UserModel.findByIdAndUpdate(userId, { role }, { new: true })
            .select("-password -mfaSecret -mfaBackupCodes -accessToken -refreshToken -resetPasswordToken")
            .lean();
        if (!user) {
            throw new Error("User not found");
        }
        return user;
    }
    /**
     * List organizations with pagination and search.
     */
    static async listOrganizations(params) {
        const { page, limit, search } = params;
        const skip = (page - 1) * limit;
        const filter = {};
        if (search) {
            const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            filter.$or = [
                { name: { $regex: escaped, $options: "i" } },
                { slug: { $regex: escaped, $options: "i" } },
            ];
        }
        const [organizations, total] = await Promise.all([
            organization_model_1.OrganizationModel.find(filter)
                .populate("ownerId", "firstName lastName email")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            organization_model_1.OrganizationModel.countDocuments(filter),
        ]);
        return { organizations, total };
    }
}
exports.AdminService = AdminService;
