import mongoose from "mongoose";
import { UserModel } from "../models/user.model";
import { ProjectModel } from "../models/project.model";
import { LogModel } from "../models/log.model";
import { OrganizationModel } from "../models/organization.model";

// ============================================
// TYPES
// ============================================

export interface UserStats {
  totalUsers: number;
  newThisWeek: number;
  newThisMonth: number;
  activeUsersToday: number;
  totalOrganizations: number;
  newOrgsThisWeek: number;
}

export interface UsageStats {
  totalLogs: number;
  logsToday: number;
  logsThisWeek: number;
  logsThisMonth: number;
  totalProjects: number;
  activeProjects: number;
  avgLogsPerProject: number;
  topProjectsByVolume: Array<{
    projectId: string;
    name: string;
    logCount: number;
  }>;
}

export interface SystemHealth {
  mongodb: {
    status: string;
    connections: number;
    dbSize: number;
  };
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  nodeVersion: string;
}

export interface UsageTrendPoint {
  date: string;
  logs: number;
  errors: number;
  users: number;
}

export interface ListUsersParams {
  page: number;
  limit: number;
  search?: string;
  role?: string;
}

export interface ListOrganizationsParams {
  page: number;
  limit: number;
  search?: string;
}

// ============================================
// SERVICE
// ============================================

export class AdminService {
  /**
   * Get user and growth KPIs.
   */
  static async getUserStats(): Promise<UserStats> {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(now);
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    const startOfMonth = new Date(now);
    startOfMonth.setDate(startOfMonth.getDate() - 30);

    const [
      totalUsers,
      newThisWeek,
      newThisMonth,
      activeUsersToday,
      totalOrganizations,
      newOrgsThisWeek,
    ] = await Promise.all([
      UserModel.countDocuments(),
      UserModel.countDocuments({ joinedAt: { $gte: startOfWeek } }),
      UserModel.countDocuments({ joinedAt: { $gte: startOfMonth } }),
      // Estimate active users: users who joined today or have recent activity
      // Since we don't track last login, we use joinedAt + updatedAt as proxy
      UserModel.countDocuments({
        $or: [
          { joinedAt: { $gte: startOfToday } },
          { updatedAt: { $gte: startOfToday } },
        ],
      }),
      OrganizationModel.countDocuments(),
      OrganizationModel.countDocuments({ createdAt: { $gte: startOfWeek } }),
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
  static async getUsageStats(): Promise<UsageStats> {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(now);
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    const startOfMonth = new Date(now);
    startOfMonth.setDate(startOfMonth.getDate() - 30);

    const [
      totalLogs,
      logsToday,
      logsThisWeek,
      logsThisMonth,
      totalProjects,
      activeProjects,
      topProjectsAgg,
    ] = await Promise.all([
      LogModel.countDocuments(),
      LogModel.countDocuments({ createdAt: { $gte: startOfToday } }),
      LogModel.countDocuments({ createdAt: { $gte: startOfWeek } }),
      LogModel.countDocuments({ createdAt: { $gte: startOfMonth } }),
      ProjectModel.countDocuments(),
      // Active projects: those with logs in the last 7 days
      ProjectModel.countDocuments({ lastIngestedAt: { $gte: startOfWeek } }),
      // Top 10 projects by log count
      ProjectModel.aggregate([
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

    const avgLogsPerProject =
      totalProjects > 0 ? Math.round(totalLogs / totalProjects) : 0;

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
  static async getSystemHealth(): Promise<SystemHealth> {
    let mongoStatus = "disconnected";
    let connections = 0;
    let dbSize = 0;

    try {
      const mongoState = mongoose.connection.readyState;
      mongoStatus =
        mongoState === 1
          ? "connected"
          : mongoState === 2
          ? "connecting"
          : mongoState === 3
          ? "disconnecting"
          : "disconnected";

      if (mongoState === 1 && mongoose.connection.db) {
        const adminDb = mongoose.connection.db.admin();
        const serverStatus = await adminDb.serverStatus();
        connections = serverStatus?.connections?.current || 0;

        const dbStats = await mongoose.connection.db.stats();
        dbSize = dbStats?.dataSize || 0;
      }
    } catch (err) {
      // If we can't get extended stats (e.g. Atlas restrictions), provide basics
      mongoStatus =
        mongoose.connection.readyState === 1 ? "connected" : "disconnected";
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
  static async getUsageTrends(days: number): Promise<UsageTrendPoint[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Aggregate logs per day
    const logTrendsPromise = LogModel.aggregate([
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
    const userTrendsPromise = UserModel.aggregate([
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
    const dateMap = new Map<string, UsageTrendPoint>();
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
  static async listUsers(params: ListUsersParams) {
    const { page, limit, search, role } = params;
    const skip = (page - 1) * limit;

    const filter: any = {};
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
      UserModel.find(filter)
        .select("-password -mfaSecret -mfaBackupCodes -accessToken -refreshToken -resetPasswordToken")
        .sort({ joinedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      UserModel.countDocuments(filter),
    ]);

    return { users, total };
  }

  /**
   * Update a user's role.
   */
  static async updateUserRole(
    userId: string,
    role: string
  ) {
    if (!["developer", "admin"].includes(role)) {
      throw new Error("Invalid role. Must be 'developer' or 'admin'.");
    }

    const user = await UserModel.findByIdAndUpdate(
      userId,
      { role },
      { new: true }
    )
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
  static async listOrganizations(params: ListOrganizationsParams) {
    const { page, limit, search } = params;
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { slug: { $regex: escaped, $options: "i" } },
      ];
    }

    const [organizations, total] = await Promise.all([
      OrganizationModel.find(filter)
        .populate("ownerId", "firstName lastName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      OrganizationModel.countDocuments(filter),
    ]);

    return { organizations, total };
  }
}
