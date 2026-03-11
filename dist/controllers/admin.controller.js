"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
const admin_service_1 = require("../services/admin.service");
/**
 * AdminController - Handles all admin-only HTTP requests.
 */
class AdminController {
    /**
     * GET /admin/stats
     * Returns combined user + usage KPIs.
     */
    static async getStats(req, res) {
        try {
            const [userStats, usageStats] = await Promise.all([
                admin_service_1.AdminService.getUserStats(),
                admin_service_1.AdminService.getUsageStats(),
            ]);
            return res.json({
                status: "success",
                data: { userStats, usageStats },
            });
        }
        catch (error) {
            console.error("AdminController.getStats error:", error);
            return res.status(500).json({
                status: "error",
                message: error instanceof Error ? error.message : "Failed to fetch admin stats",
            });
        }
    }
    /**
     * GET /admin/users
     * List users with pagination, search, and role filter.
     * Query params: ?page, ?limit, ?search, ?role
     */
    static async listUsers(req, res) {
        try {
            const page = Math.max(1, parseInt(req.query.page) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
            const search = req.query.search || undefined;
            const role = req.query.role || undefined;
            const result = await admin_service_1.AdminService.listUsers({ page, limit, search, role });
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
        }
        catch (error) {
            console.error("AdminController.listUsers error:", error);
            return res.status(500).json({
                status: "error",
                message: error instanceof Error ? error.message : "Failed to list users",
            });
        }
    }
    /**
     * PUT /admin/users/:userId
     * Update a user (currently supports role changes).
     * Body: { role: "developer" | "admin" }
     */
    static async updateUser(req, res) {
        try {
            const { userId } = req.params;
            const { role } = req.body;
            if (!role) {
                return res.status(400).json({
                    status: "error",
                    message: "Role is required",
                });
            }
            const updatedUser = await admin_service_1.AdminService.updateUserRole(userId, role);
            return res.json({
                status: "success",
                message: "User role updated successfully",
                data: updatedUser,
            });
        }
        catch (error) {
            console.error("AdminController.updateUser error:", error);
            const message = error instanceof Error ? error.message : "Failed to update user";
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
    static async listOrganizations(req, res) {
        try {
            const page = Math.max(1, parseInt(req.query.page) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
            const search = req.query.search || undefined;
            const result = await admin_service_1.AdminService.listOrganizations({
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
        }
        catch (error) {
            console.error("AdminController.listOrganizations error:", error);
            return res.status(500).json({
                status: "error",
                message: error instanceof Error
                    ? error.message
                    : "Failed to list organizations",
            });
        }
    }
    /**
     * GET /admin/system
     * Returns system health information.
     */
    static async getSystemHealth(req, res) {
        try {
            const health = await admin_service_1.AdminService.getSystemHealth();
            return res.json({
                status: "success",
                data: health,
            });
        }
        catch (error) {
            console.error("AdminController.getSystemHealth error:", error);
            return res.status(500).json({
                status: "error",
                message: error instanceof Error
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
    static async getUsageTrends(req, res) {
        try {
            const days = Math.min(90, Math.max(1, parseInt(req.query.days) || 30));
            const trends = await admin_service_1.AdminService.getUsageTrends(days);
            return res.json({
                status: "success",
                data: trends,
                meta: { days },
            });
        }
        catch (error) {
            console.error("AdminController.getUsageTrends error:", error);
            return res.status(500).json({
                status: "error",
                message: error instanceof Error
                    ? error.message
                    : "Failed to fetch usage trends",
            });
        }
    }
}
exports.AdminController = AdminController;
