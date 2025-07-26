import { Schema, model, Types, Document } from "mongoose";

export interface IAlertRules extends Document {
  projectId: Types.ObjectId;
  name: string;
  condition: any;
  isActive: boolean;
  notifyChannels: any;
  notificationConfig: any;
  createdAt?: Date;
}

const AlertRuleSchema: Schema<IAlertRules> = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    name: { type: String, required: true },
    condition: {
      level: {
        type: String,
        enum: ["trace", "debug", "info", "warn", "error", "fatal"],
      },
      keyword: { type: String },
      frequency: { type: Number },
      intervalMinutes: { type: Number, default: 10 },
    },
    isActive: { type: Boolean, default: true },
    notifyChannels: {
      type: [String],
      enum: ["email", "slack", "webhook"],
      default: ["email"],
    },
    notificationConfig: {
      type: Object,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export const AlertRuleModel = model<IAlertRules>("AlertRule", AlertRuleSchema);
