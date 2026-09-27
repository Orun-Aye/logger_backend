import mongoose, { Schema, Document } from "mongoose";

/**
 * Per-project AI usage for one calendar month (UTC). Persisted, unlike the
 * hourly token counter in AIService, so the monthly cap survives restarts.
 */
export interface IAiUsage extends Document {
  projectId: string;
  /** "YYYY-MM" in UTC. */
  month: string;
  /** Commit summaries generated (or reserved in flight) this month. */
  summaries: number;
  createdAt: Date;
  updatedAt: Date;
}

const AiUsageSchema: Schema = new Schema<IAiUsage>(
  {
    projectId: { type: String, required: true },
    month: { type: String, required: true },
    summaries: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

AiUsageSchema.index({ projectId: 1, month: 1 }, { unique: true });

export const AiUsageModel = mongoose.model<IAiUsage>("AiUsage", AiUsageSchema);
