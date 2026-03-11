"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditAction = auditAction;
const auditLog_service_1 = require("../services/auditLog.service");
/**
 * Middleware factory that logs an action to the audit log after the
 * response has been sent successfully (status < 400).
 *
 * Usage:
 *   router.post("/:orgId/teams", verifyToken, requireOrgRole("owner","admin"), auditAction("team.created","team"), controller)
 *
 * - Captures IP from `req.ip` or `x-forwarded-for` header.
 * - Captures `resourceId` from `req.params` (orgId, teamId, userId) when available.
 * - Only logs when the response status is < 400 (success).
 * - Audit logging failures are caught silently to avoid disrupting the request.
 */
function auditAction(action, resource) {
    return (req, res, next) => {
        // Hook into the response 'finish' event so we log AFTER the response
        res.on("finish", async () => {
            try {
                // Only log successful actions
                if (res.statusCode >= 400) {
                    return;
                }
                const orgId = req.params.orgId;
                const userId = req.userId;
                if (!orgId || !userId) {
                    return; // Can't log without org or user context
                }
                // Determine the most specific resource ID from params
                const resourceId = req.params.teamId || req.params.userId || req.params.orgId || undefined;
                // Get client IP
                const forwarded = req.headers["x-forwarded-for"];
                const ipAddress = (typeof forwarded === "string" ? forwarded.split(",")[0].trim() : undefined) ||
                    req.ip ||
                    undefined;
                await auditLog_service_1.AuditLogService.log(orgId, userId, action, resource, resourceId, {
                    method: req.method,
                    path: req.originalUrl,
                    statusCode: res.statusCode,
                }, ipAddress);
            }
            catch (error) {
                // Audit logging should never crash the request
                console.error("Audit log middleware error:", error);
            }
        });
        next();
    };
}
