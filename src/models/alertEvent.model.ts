import { Schema, model, Types, Document } from "mongoose";

export interface IAlertEvent extends Document {
  projectId: Types.ObjectId;
  ruleId?: Types.ObjectId;
  logId?: Types.ObjectId;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  notifyChannels?: ("email" | "slack" | "webhook" | "github")[];
  metadata?: Record<string, any>;
  status?: "active" | "acknowledged" | "resolved" | "snoozed";
  tags?: string[];
  environment?: string;
  service?: string;
  acknowledgedAt?: Date;
  acknowledgedBy?: Types.ObjectId;
  resolvedAt?: Date;
  resolvedBy?: Types.ObjectId;
  resolutionNotes?: string;
  snoozedUntil?: Date;
  snoozedBy?: Types.ObjectId;
  escalationLevel?: number; // Current escalation level (0 = initial)
  lastEscalatedAt?: Date;
  occurenceCount?: number; // Number of times this alert has been triggered
  triggeredAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const AlertEventSchema: Schema<IAlertEvent> = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    ruleId: { type: Schema.Types.ObjectId, ref: "AlertRule", index: true },
    logId: { type: Schema.Types.ObjectId, ref: "Log" },
    title: { type: String, required: true },
    message: { type: String, required: true },
    severity: { type: String, enum: ["info", "warning", "critical"], default: "warning", index: true },
    notifyChannels: { type: [String], enum: ["email", "slack", "webhook", "github"], default: ["email"] },
    tags: { type: [String] },
    environment: { type: String, index: true },
    service: { type: String, index: true },
    metadata: { type: Schema.Types.Mixed },
    status: { type: String, enum: ["active", "acknowledged", "resolved", "snoozed"], default: "active", index: true },
    acknowledgedAt: { type: Date },
    acknowledgedBy: { type: Schema.Types.ObjectId, ref: "User" },
    resolvedAt: { type: Date },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    resolutionNotes: { type: String },
    snoozedUntil: { type: Date },
    snoozedBy: { type: Schema.Types.ObjectId, ref: "User" },
    escalationLevel: { type: Number, default: 0 },
    lastEscalatedAt: { type: Date },
    occurenceCount: { type: Number, default: 1 },
    triggeredAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
AlertEventSchema.index({ projectId: 1, triggeredAt: -1 });
AlertEventSchema.index({ projectId: 1, status: 1, severity: 1 });
AlertEventSchema.index({ ruleId: 1, status: 1 });
AlertEventSchema.index({ resolvedAt: 1 }); // For MTTR calculations

export const AlertEventModel = model<IAlertEvent>("AlertEvent", AlertEventSchema);


