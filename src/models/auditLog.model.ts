import mongoose, { Document, Schema, Types } from "mongoose";

export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: { type: String, required: true },
    resource: { type: String, required: true },
    resourceId: { type: String },
    details: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  {
    // No timestamps option — we use our own `timestamp` field
  }
);

// TTL index: auto-delete entries older than 90 days
AuditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Compound indexes for efficient querying
AuditLogSchema.index({ organizationId: 1, timestamp: -1 });
AuditLogSchema.index({ organizationId: 1, resource: 1 });
AuditLogSchema.index({ organizationId: 1, userId: 1 });
AuditLogSchema.index({ organizationId: 1, action: 1 });

export const AuditLogModel = mongoose.model<IAuditLog>(
  "AuditLog",
  AuditLogSchema
);
