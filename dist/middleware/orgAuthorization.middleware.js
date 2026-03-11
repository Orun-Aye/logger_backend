"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireOrgRole = requireOrgRole;
const mongoose_1 = __importDefault(require("mongoose"));
const organization_model_1 = require("../models/organization.model");
/**
 * Middleware factory that checks whether the authenticated user has one of
 * the specified roles within the organization identified by `req.params.orgId`.
 *
 * Usage:
 *   router.put("/:orgId", verifyToken, requireOrgRole("owner", "admin"), controller)
 *
 * - Returns 400 if orgId is missing or invalid.
 * - Returns 404 if the organization does not exist.
 * - Returns 403 if the user is not a member or lacks the required role.
 */
function requireOrgRole(...roles) {
    return async (req, res, next) => {
        try {
            const { orgId } = req.params;
            if (!orgId || !mongoose_1.default.Types.ObjectId.isValid(orgId)) {
                return res.status(400).json({
                    status: "error",
                    message: "Invalid or missing organization ID",
                });
            }
            const userId = req.userId;
            if (!userId) {
                return res.status(401).json({
                    status: "error",
                    message: "Authentication required",
                });
            }
            const org = await organization_model_1.OrganizationModel.findById(orgId).lean();
            if (!org) {
                return res.status(404).json({
                    status: "error",
                    message: "Organization not found",
                });
            }
            const member = org.members.find((m) => m.user.toString() === userId);
            if (!member) {
                return res.status(403).json({
                    status: "error",
                    message: "You are not a member of this organization",
                });
            }
            if (roles.length > 0 && !roles.includes(member.role)) {
                return res.status(403).json({
                    status: "error",
                    message: `Insufficient permissions. Required role: ${roles.join(" or ")}`,
                });
            }
            // Attach org info to request for downstream use (optional)
            req.orgRole = member.role;
            next();
        }
        catch (error) {
            console.error("OrgAuthorization middleware error:", error);
            return res.status(500).json({
                status: "error",
                message: "Authorization check failed",
            });
        }
    };
}
