import { Request, Response } from "express";
import { AdminService } from "../services/admin.service";

/**
 * AdminController - Handles all admin-only HTTP requests.
 */
export class AdminController {
  /**
   * GET /admin/stats
   * Returns combined user + usage KPIs.
   */
  static async getStats(req: Request, res: Response) {
    try {
      const [userStats, usageStats] = await Promise.all([
        AdminService.getUserStats(),
        AdminService.getUsageStats(),
      ]);

      return res.json({
        status: "success",
        data: { userStats, usageStats },
      });
    } catch (error) {
      console.error("AdminController.getStats error:", error);
      return res.status(500).json({
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to fetch admin stats",
      });
    }
  }

  /**
   * GET /admin/users
   * List users with pagination, search, and role filter.
   * Query params: ?page, ?limit, ?search, ?role
   */
  static async listUsers(req: Request, res: Response) {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(
        100,
        Math.max(1, parseInt(req.query.limit as string) || 20)
      );
      const search = (req.query.search as string) || undefined;
      const role = (req.query.role as string) || undefined;

      const result = await AdminService.listUsers({ page, limit, search, role });

      return res.json({
        status: "success",
        data: result.users,
        meta: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      });
    } catch (error) {
      console.error("AdminController.listUsers error:", error);
      return res.status(500).json({
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to list users",
      });
    }
  }

  /**
   * PUT /admin/users/:userId
   * Update a user (currently supports role changes).
   * Body: { role: "developer" | "admin" }
   */
  static async updateUser(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      if (!role) {
        return res.status(400).json({
          status: "error",
          message: "Role is required",
        });
      }

      const updatedUser = await AdminService.updateUserRole(userId, role);

      return res.json({
        status: "success",
        message: "User role updated successfully",
        data: updatedUser,
      });
    } catch (error) {
      console.error("AdminController.updateUser error:", error);
      const message =
        error instanceof Error ? error.message : "Failed to update user";
      const status = message.includes("not found") ? 404 : 400;
      return res.status(status).json({
        status: "error",
        message,
      });
    }
  }

  /**
   * GET /admin/organizations
   * List organizations with pagination and search.
   * Query params: ?page, ?limit, ?search
   */
  static async listOrganizations(req: Request, res: Response) {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(
        100,
        Math.max(1, parseInt(req.query.limit as string) || 20)
      );
      const search = (req.query.search as string) || undefined;

      const result = await AdminService.listOrganizations({
        page,
        limit,
        search,
      });

      return res.json({
        status: "success",
        data: result.organizations,
        meta: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      });
    } catch (error) {
      console.error("AdminController.listOrganizations error:", error);
      return res.status(500).json({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to list organizations",
      });
    }
  }

  /**
   * GET /admin/system
   * Returns system health information.
   */
  static async getSystemHealth(req: Request, res: Response) {
    try {
      const health = await AdminService.getSystemHealth();

      return res.json({
        status: "success",
        data: health,
      });
    } catch (error) {
      console.error("AdminController.getSystemHealth error:", error);
      return res.status(500).json({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch system health",
      });
    }
  }

  /**
   * GET /admin/usage-trends
   * Returns usage trends over a specified number of days.
   * Query params: ?days (default: 30)
   */
  static async getUsageTrends(req: Request, res: Response) {
    try {
      const days = Math.min(
        90,
        Math.max(1, parseInt(req.query.days as string) || 30)
      );

      const trends = await AdminService.getUsageTrends(days);

      return res.json({
        status: "success",
        data: trends,
        meta: { days },
      });
    } catch (error) {
      console.error("AdminController.getUsageTrends error:", error);
      return res.status(500).json({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch usage trends",
      });
    }
  }
}
