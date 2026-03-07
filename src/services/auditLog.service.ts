import mongoose from "mongoose";
import { AuditLogModel, IAuditLog } from "../models/auditLog.model";

// ---------- Custom Errors ----------

export class AuditLogValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuditLogValidationError";
  }
}

// ---------- Types ----------

export interface AuditLogFilters {
  action?: string;
  resource?: string;
  userId?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  page?: number;
  limit?: number;
}

export interface AuditLogQueryResult {
  data: IAuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ---------- Service ----------

export class AuditLogService {
  /**
   * Create an audit log entry.
   */
  static async log(
    orgId: string,
    userId: string,
    action: string,
    resource: string,
    resourceId?: string,
    details?: Record<string, any>,
    ipAddress?: string
  ): Promise<IAuditLog> {
    try {
      if (!mongoose.Types.ObjectId.isValid(orgId)) {
        throw new AuditLogValidationError("Invalid organization ID");
      }
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new AuditLogValidationError("Invalid user ID");
      }
      if (!action || !resource) {
        throw new AuditLogValidationError("Action and resource are required");
      }

      const entry = new AuditLogModel({
        organizationId: new mongoose.Types.ObjectId(orgId),
        userId: new mongoose.Types.ObjectId(userId),
        action,
        resource,
        resourceId,
        details,
        ipAddress,
        timestamp: new Date(),
      });

      const saved = await entry.save();
      return saved;
    } catch (error) {
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
  static async query(
    orgId: string,
    filters: AuditLogFilters = {}
  ): Promise<AuditLogQueryResult> {
    try {
      if (!mongoose.Types.ObjectId.isValid(orgId)) {
        throw new AuditLogValidationError("Invalid organization ID");
      }

      const page = Math.max(1, filters.page || 1);
      const limit = Math.min(100, Math.max(1, filters.limit || 50));
      const skip = (page - 1) * limit;

      // Build query filter
      const query: Record<string, any> = {
        organizationId: new mongoose.Types.ObjectId(orgId),
      };

      if (filters.action) {
        query.action = filters.action;
      }
      if (filters.resource) {
        query.resource = filters.resource;
      }
      if (filters.userId && mongoose.Types.ObjectId.isValid(filters.userId)) {
        query.userId = new mongoose.Types.ObjectId(filters.userId);
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
        AuditLogModel.find(query)
          .populate("userId", "email firstName lastName")
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit)
          .lean<IAuditLog[]>(),
        AuditLogModel.countDocuments(query),
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
    } catch (error) {
      if (error instanceof AuditLogValidationError) {
        throw error;
      }
      throw new Error(`Failed to query audit log: ${error}`);
    }
  }

  /**
   * Export audit log entries as JSON or CSV.
   */
  static async exportAuditLog(
    orgId: string,
    filters: AuditLogFilters = {},
    format: "json" | "csv" = "json"
  ): Promise<{ data: string; contentType: string; filename: string }> {
    try {
      if (!mongoose.Types.ObjectId.isValid(orgId)) {
        throw new AuditLogValidationError("Invalid organization ID");
      }

      // Build query filter (same as query method, but no pagination limit)
      const query: Record<string, any> = {
        organizationId: new mongoose.Types.ObjectId(orgId),
      };

      if (filters.action) {
        query.action = filters.action;
      }
      if (filters.resource) {
        query.resource = filters.resource;
      }
      if (filters.userId && mongoose.Types.ObjectId.isValid(filters.userId)) {
        query.userId = new mongoose.Types.ObjectId(filters.userId);
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
      const entries = await AuditLogModel.find(query)
        .populate("userId", "email firstName lastName")
        .sort({ timestamp: -1 })
        .limit(10000)
        .lean<IAuditLog[]>();

      const timestamp = new Date().toISOString().split("T")[0];

      if (format === "csv") {
        const csvHeader = "Timestamp,Action,Resource,ResourceId,User,IP Address,Details\n";
        const csvRows = entries
          .map((entry) => {
            const user = entry.userId as any;
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
    } catch (error) {
      if (error instanceof AuditLogValidationError) {
        throw error;
      }
      throw new Error(`Failed to export audit log: ${error}`);
    }
  }
}
