import { Schema, model, Types } from "mongoose";

const AlertRuleSchema = new Schema(
  {
    projectId: { type: Types.ObjectId, ref: "Project", required: true },
    name: { type: String, required: true },
    condition: {
      field: { type: String, required: true },  // e.g., "level"
      operator: { type: String, enum: ["equals", "contains"], required: true },
      value: { type: String, required: true },
    },
    threshold: {
      count: { type: Number, required: true },
      durationMinutes: { type: Number, required: true },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const AlertRuleModel = model("AlertRule", AlertRuleSchema);
