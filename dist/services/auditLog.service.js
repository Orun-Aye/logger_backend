"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogService = exports.AuditLogValidationError = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const auditLog_model_1 = require("../models/auditLog.model");
// ---------- Custom Errors ----------
class AuditLogValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "AuditLogValidationError";
    }
}
exports.AuditLogValidationError = AuditLogValidationError;
// ---------- Service ----------
class AuditLogService {
    /**
     * Create an audit log entry.
     */
    static async log(orgId, userId, action, resource, resourceId, details, ipAddress) {
        try {
            if (!mongoose_1.default.Types.ObjectId.isValid(orgId)) {
                throw new AuditLogValidationError("Invalid organization ID");
            }
            if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
                throw new AuditLogValidationError("Invalid user ID");
            }
            if (!action || !resource) {
                throw new AuditLogValidationError("Action and resource are required");
            }
            const entry = new auditLog_model_1.AuditLogModel({
                organizationId: new mongoose_1.default.Types.ObjectId(orgId),
                userId: new mongoose_1.default.Types.ObjectId(userId),
                action,
                resource,
                resourceId,
                details,
                ipAddress,
                timestamp: new Date(),
            });
            const saved = await entry.save();
            return saved;
        }
        catch (error) {
            if (error instanceof AuditLogValidationError) {
                throw error;
            }
            // Audit logging should not crash the caller — log and return silently
            console.error(`Failed to create audit log entry: ${error}`);
            throw new Error(`Failed to create audit log entry: ${error}`);
        }
    }
    /**
     * Query audit log entries with pagination and filters.
     */
    static async query(orgId, filters = {}) {
        try {
            if (!mongoose_1.default.Types.ObjectId.isValid(orgId)) {
                throw new AuditLogValidationError("Invalid organization ID");
            }
            const page = Math.max(1, filters.page || 1);
            const limit = Math.min(100, Math.max(1, filters.limit || 50));
            const skip = (page - 1) * limit;
            // Build query filter
            const query = {
                organizationId: new mongoose_1.default.Types.ObjectId(orgId),
            };
            if (filters.action) {
                query.action = filters.action;
            }
            if (filters.resource) {
                query.resource = filters.resource;
            }
            if (filters.userId && mongoose_1.default.Types.ObjectId.isValid(filters.userId)) {
                query.userId = new mongoose_1.default.Types.ObjectId(filters.userId);
            }
            if (filters.startDate || filters.endDate) {
                query.timestamp = {};
                if (filters.startDate) {
                    query.timestamp.$gte = new Date(filters.startDate);
                }
                if (filters.endDate) {
                    query.timestamp.$lte = new Date(filters.endDate);
                }
            }
            const [data, total] = await Promise.all([
                auditLog_model_1.AuditLogModel.find(query)
                    .populate("userId", "email firstName lastName")
                    .sort({ timestamp: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                auditLog_model_1.AuditLogModel.countDocuments(query),
            ]);
            return {
                data,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            };
        }
        catch (error) {
            if (error instanceof AuditLogValidationError) {
                throw error;
            }
            throw new Error(`Failed to query audit log: ${error}`);
        }
    }
    /**
     * Export audit log entries as JSON or CSV.
     */
    static async exportAuditLog(orgId, filters = {}, format = "json") {
        try {
            if (!mongoose_1.default.Types.ObjectId.isValid(orgId)) {
                throw new AuditLogValidationError("Invalid organization ID");
            }
            // Build query filter (same as query method, but no pagination limit)
            const query = {
                organizationId: new mongoose_1.default.Types.ObjectId(orgId),
            };
            if (filters.action) {
                query.action = filters.action;
            }
            if (filters.resource) {
                query.resource = filters.resource;
            }
            if (filters.userId && mongoose_1.default.Types.ObjectId.isValid(filters.userId)) {
                query.userId = new mongoose_1.default.Types.ObjectId(filters.userId);
            }
            if (filters.startDate || filters.endDate) {
                query.timestamp = {};
                if (filters.startDate) {
                    query.timestamp.$gte = new Date(filters.startDate);
                }
                if (filters.endDate) {
                    query.timestamp.$lte = new Date(filters.endDate);
                }
            }
            // Cap export at 10,000 entries
            const entries = await auditLog_model_1.AuditLogModel.find(query)
                .populate("userId", "email firstName lastName")
                .sort({ timestamp: -1 })
                .limit(10000)
                .lean();
            const timestamp = new Date().toISOString().split("T")[0];
            if (format === "csv") {
                const csvHeader = "Timestamp,Action,Resource,ResourceId,User,IP Address,Details\n";
                const csvRows = entries
                    .map((entry) => {
                    const user = entry.userId;
                    const userName = user?.email || entry.userId?.toString() || "";
                    const details = entry.details
                        ? JSON.stringify(entry.details).replace(/"/g, '""')
                        : "";
                    return `"${entry.timestamp.toISOString()}","${entry.action}","${entry.resource}","${entry.resourceId || ""}","${userName}","${entry.ipAddress || ""}","${details}"`;
                })
                    .join("\n");
                return {
                    data: csvHeader + csvRows,
                    contentType: "text/csv",
                    filename: `audit-log-${timestamp}.csv`,
                };
            }
            // JSON format
            return {
                data: JSON.stringify(entries, null, 2),
                contentType: "application/json",
                filename: `audit-log-${timestamp}.json`,
            };
        }
        catch (error) {
            if (error instanceof AuditLogValidationError) {
                throw error;
            }
            throw new Error(`Failed to export audit log: ${error}`);
        }
    }
}
exports.AuditLogService = AuditLogService;
