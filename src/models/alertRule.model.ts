import { Schema, model, Types, Document } from "mongoose";

// Simple condition (legacy and still supported)
export interface ISimpleCondition {
  level?: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
  keyword?: string;
  frequency?: number;
  intervalMinutes?: number;
  service?: string;
  environment?: string;
  responseTimeThreshold?: number; // ms
  eventType?: string;
}

// Composite condition with AND/OR logic
export interface ICompositeCondition {
  operator: "AND" | "OR";
  conditions: ISimpleCondition[];
  frequency?: number;
  intervalMinutes?: number;
}

export interface IAlertRules extends Document {
  projectId: Types.ObjectId;
  name: string;
  description?: string;
  // Backward compatible: can be simple or composite
  condition: ISimpleCondition | ICompositeCondition;
  isActive: boolean;
  notifyChannels: ("email" | "slack" | "webhook" | "github")[];
  notificationConfig: any;
  escalationPolicyId?: Types.ObjectId;
  snoozeUntil?: Date;
  createdBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const SimpleConditionSchema = new Schema<ISimpleCondition>(
  {
    level: {
      type: String,
      enum: ["trace", "debug", "info", "warn", "error", "fatal"],
    },
    keyword: { type: String },
    frequency: { type: Number },
    intervalMinutes: { type: Number, default: 10 },
    service: { type: String },
    environment: { type: String },
    responseTimeThreshold: { type: Number },
    eventType: { type: String },
  },
  { _id: false }
);

const AlertRuleSchema: Schema<IAlertRules> = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    // Mixed type to support both simple and composite conditions
    condition: {
      type: Schema.Types.Mixed,
      required: true,
    },
    isActive: { type: Boolean, default: true, index: true },
    notifyChannels: {
      type: [String],
      enum: ["email", "slack", "webhook", "github"],
      default: ["email"],
    },
    notificationConfig: {
      type: Object,
    },
    escalationPolicyId: {
      type: Schema.Types.ObjectId,
      ref: "EscalationPolicy",
    },
    snoozeUntil: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
AlertRuleSchema.index({ projectId: 1, isActive: 1 });
AlertRuleSchema.index({ createdAt: -1 });

// Helper method to check if rule is snoozed
AlertRuleSchema.methods.isSnoozed = function (): boolean {
  return this.snoozeUntil && this.snoozeUntil > new Date();
};

// Helper to detect if condition is composite
AlertRuleSchema.methods.isCompositeCondition = function (): boolean {
  return this.condition && typeof this.condition === 'object' && 'operator' in this.condition;
};

export const AlertRuleModel = model<IAlertRules>("AlertRule", AlertRuleSchema);
