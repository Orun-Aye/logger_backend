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
  createdAt?: Date;
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
  },
  {
    timestamps: true,
  }
);

export const ProjectModel = model<IProject>("Project", ProjectSchema);