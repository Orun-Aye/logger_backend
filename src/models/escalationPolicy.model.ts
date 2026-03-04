import { Schema, model, Types, Document } from "mongoose";

export interface IEscalationLevel {
  level: number; // 1, 2, 3, etc.
  delayMinutes: number; // Wait time before escalating to this level
  notifyChannels: ("email" | "slack" | "webhook")[];
  recipients: string[]; // Email addresses or Slack user IDs
  webhookUrl?: string;
}

export interface IEscalationPolicy extends Document {
  projectId: Types.ObjectId;
  name: string;
  description?: string;
  levels: IEscalationLevel[];
  isActive: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const EscalationLevelSchema = new Schema<IEscalationLevel>(
  {
    level: { type: Number, required: true },
    delayMinutes: { type: Number, required: true, min: 0 },
    notifyChannels: {
      type: [String],
      enum: ["email", "slack", "webhook"],
      required: true,
    },
    recipients: { type: [String], required: true },
    webhookUrl: { type: String },
  },
  { _id: false }
);

const EscalationPolicySchema = new Schema<IEscalationPolicy>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    description: { type: String },
    levels: {
      type: [EscalationLevelSchema],
      required: true,
      validate: {
        validator: (levels: IEscalationLevel[]) => levels.length > 0,
        message: "At least one escalation level is required",
      },
    },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// Index for efficient queries
EscalationPolicySchema.index({ projectId: 1, isActive: 1 });
EscalationPolicySchema.index({ createdAt: -1 });

export const EscalationPolicyModel = model<IEscalationPolicy>(
  "EscalationPolicy",
  EscalationPolicySchema
);
