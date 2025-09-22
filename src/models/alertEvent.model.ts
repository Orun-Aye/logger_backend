import { Schema, model, Types, Document } from "mongoose";

export interface IAlertEvent extends Document {
  projectId: Types.ObjectId;
  ruleId?: Types.ObjectId;
  logId?: Types.ObjectId;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  notifyChannels?: ("email" | "slack" | "webhook")[];
  metadata?: Record<string, any>;
  acknowledged?: boolean;
  acknowledgedAt?: Date;
  triggeredAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const AlertEventSchema: Schema<IAlertEvent> = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    ruleId: { type: Schema.Types.ObjectId, ref: "AlertRule" },
    logId: { type: Schema.Types.ObjectId, ref: "Log" },
    title: { type: String, required: true },
    message: { type: String, required: true },
    severity: { type: String, enum: ["info", "warning", "critical"], default: "warning", index: true },
    notifyChannels: { type: [String], enum: ["email", "slack", "webhook"], default: ["email"] },
    metadata: { type: Schema.Types.Mixed },
    acknowledged: { type: Boolean, default: false },
    acknowledgedAt: { type: Date },
    triggeredAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

AlertEventSchema.index({ projectId: 1, triggeredAt: -1 });

export const AlertEventModel = model<IAlertEvent>("AlertEvent", AlertEventSchema);


