import { Schema, model, Types, Document } from "mongoose";

export interface IAlertRules extends Document {
  projectId: Types.ObjectId;
  name: string;
  condition: any;
  isActive: boolean;
  notifyVia: any;
  notificationConfig: any;
  createdAt?: Date
}

const AlertRuleSchema: Schema<IAlertRules> = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    name: { type: String, required: true },
    condition: {
      type: Object,
      required: true,
    },
    isActive: { type: Boolean, default: true },
    notifyVia: {
      type: [String],
      enum: ["email", "slack", "webhook"],
      default: ["email"],
    },
    notificationConfig: {
      type: Object,
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
  },
  { timestamps: true }
);

export const AlertRuleModel = model<IAlertRules>("AlertRule", AlertRuleSchema);
