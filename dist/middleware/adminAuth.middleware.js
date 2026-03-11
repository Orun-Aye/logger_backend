"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = requireAdmin;
const user_model_1 = require("../models/user.model");
/**
 * Admin authorization middleware.
 * Must run AFTER verifyToken so that req.userId is already set.
 * Looks up the user and rejects with 403 if their role is not "admin".
 */
async function requireAdmin(req, res, next) {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({
                status: "error",
                code: "UNAUTHORIZED",
                message: "Authentication required",
            });
        }
        const user = await user_model_1.UserModel.findById(userId).select("role").lean();
        if (!user) {
            return res.status(404).json({
                status: "error",
                code: "USER_NOT_FOUND",
                message: "User not found",
            });
        }
        if (user.role !== "admin") {
            return res.status(403).json({
                status: "error",
                code: "FORBIDDEN",
                message: "Admin access required",
            });
        }
        next();
    }
    catch (error) {
        console.error("AdminAuth middleware error:", error);
        return res.status(500).json({
            status: "error",
            code: "SERVER_ERROR",
            message: "Failed to verify admin access",
        });
    }
}
