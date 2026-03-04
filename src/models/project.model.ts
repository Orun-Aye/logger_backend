import { Document, Schema, Types, model } from "mongoose";

export interface IProject extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  apiKey: string;
  ownerId?: Types.ObjectId; // Optional field for owner reference
  teamMembers: {
    user: Types.ObjectId;
    role: "viewer" | "admin";
  }[];
  isActive: boolean;
  logCount?: number;
  alertRuleCount?: number;
  integrationSettings?: any;
  rateLimitConfig?: {
    maxRequestsPerMinute: number;
    burstLimit: number
  };
  tags?: string[];
  lastIngestedAt?: Date;
  retentionConfig?: {
    retentionDays: number;
    autoCleanupEnabled: boolean;
  };
  samplingConfig?: {
    enabled: boolean;
    mode: "rate" | "percentage";
    value: number;
    alwaysKeepLevels: string[];
  };
  createdAt: Date;
  updatedAt?: Date;
}

const ProjectSchema: Schema<IProject> = new Schema(
  {
    _id: { type: Schema.Types.ObjectId, auto: true },
    name: { type: String, required: true, unique: true },
    apiKey: { type: String, required: true, unique: true },
    description: { type: String },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true }, // Reference to User model
    teamMembers: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User", required: true },
        role: { type: String, enum: ["viewer", "admin"], default: "viewer" }
      }
    ],
    isActive: { type: Boolean, default: true },
    logCount: { type: Number, default: 0 },
    alertRuleCount: { type: Number, default: 0 },
    integrationSettings: { type: Schema.Types.Mixed, default: {} },
    rateLimitConfig: {
      maxRequestsPerMinute: { type: Number, default: 100 },
      burstLimit: { type: Number, default: 10 }
    },
    tags: { type: [String], default: [] },
    lastIngestedAt: { type: Date },
    retentionConfig: {
      retentionDays: { type: Number, default: 30 },
      autoCleanupEnabled: { type: Boolean, default: true },
    },
    samplingConfig: {
      enabled: { type: Boolean, default: false },
      mode: { type: String, enum: ["rate", "percentage"], default: "percentage" },
      value: { type: Number, default: 100, min: 1, max: 1000 },
      alwaysKeepLevels: { type: [String], default: ["error", "fatal"] },
    },
  },
  {
    timestamps: true,
  }
);

export const ProjectModel = model<IProject>("Project", ProjectSchema);