import mongoose, { Schema, Document } from "mongoose";

export type AnomalyType =
  | "log_volume_spike"
  | "error_rate_increase"
  | "response_time_degradation"
  | "error_spike";

export type AnomalySeverity = "critical" | "warning" | "info";

export interface IAnomaly extends Document {
  projectId: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  metric: string;
  currentValue: number;
  baselineValue: number;
  deviation: number;
  percentChange: number;
  description: string;
  detectedAt: Date;
  resolvedAt: Date | null;
  acknowledged: boolean;
  acknowledgedBy: mongoose.Types.ObjectId | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const AnomalySchema: Schema = new Schema<IAnomaly>(
  {
    projectId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        "log_volume_spike",
        "error_rate_increase",
        "response_time_degradation",
        "error_spike",
      ],
    },
    severity: {
      type: String,
      required: true,
      enum: ["critical", "warning", "info"],
    },
    metric: {
      type: String,
      required: true,
    },
    currentValue: {
      type: Number,
      required: true,
    },
    baselineValue: {
      type: Number,
      required: true,
    },
    deviation: {
      type: Number,
      required: true,
    },
    percentChange: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    detectedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    acknowledged: {
      type: Boolean,
      default: false,
    },
    acknowledgedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
AnomalySchema.index({ projectId: 1, detectedAt: -1 });
AnomalySchema.index({ projectId: 1, type: 1, resolvedAt: 1 });
// TTL index: auto-delete anomalies older than 90 days
AnomalySchema.index({ detectedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const AnomalyModel = mongoose.model<IAnomaly>("Anomaly", AnomalySchema);
