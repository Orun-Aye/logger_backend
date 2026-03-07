import mongoose, { Document, Schema, Types } from "mongoose";

export type IntegrationType =
  | "github"
  | "jira"
  | "pagerduty"
  | "discord"
  | "teams"
  | "linear";

export type IntegrationStatus = "connected" | "disconnected" | "error";

export interface IIntegrationConfig {
  accessToken?: string;
  refreshToken?: string;
  webhookUrl?: string;
  baseUrl?: string;
  repo?: string;
  project?: string;
  serviceId?: string;
  channelId?: string;
  teamId?: string;
  email?: string;
}

export interface IIntegrationMetadata {
  installationId?: string;
  workspaceName?: string;
  lastSyncAt?: Date;
  syncErrors?: string[];
}

export interface IIntegration extends Document {
  _id: Types.ObjectId;
  organizationId?: Types.ObjectId;
  projectId?: Types.ObjectId;
  type: IntegrationType;
  status: IntegrationStatus;
  config: IIntegrationConfig;
  metadata: IIntegrationMetadata;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const IntegrationSchema = new Schema<IIntegration>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
    projectId: { type: Schema.Types.ObjectId, ref: "Project" },
    type: {
      type: String,
      required: true,
      enum: ["github", "jira", "pagerduty", "discord", "teams", "linear"],
    },
    status: {
      type: String,
      required: true,
      enum: ["connected", "disconnected", "error"],
      default: "disconnected",
    },
    config: {
      accessToken: { type: String },
      refreshToken: { type: String },
      webhookUrl: { type: String },
      baseUrl: { type: String },
      repo: { type: String },
      project: { type: String },
      serviceId: { type: String },
      channelId: { type: String },
      teamId: { type: String },
      email: { type: String },
    },
    metadata: {
      installationId: { type: String },
      workspaceName: { type: String },
      lastSyncAt: { type: Date },
      syncErrors: { type: [String], default: [] },
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
IntegrationSchema.index({ createdBy: 1 });
IntegrationSchema.index({ organizationId: 1 }, { sparse: true });
IntegrationSchema.index({ projectId: 1 }, { sparse: true });
IntegrationSchema.index({ type: 1, createdBy: 1 });
IntegrationSchema.index({ type: 1, projectId: 1 }, { sparse: true });

export const IntegrationModel = mongoose.model<IIntegration>(
  "Integration",
  IntegrationSchema
);
