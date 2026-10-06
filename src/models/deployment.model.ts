import mongoose, { Schema, Document } from "mongoose";

export type DeploymentStatus =
  | "pending"
  | "in_progress"
  | "success"
  | "failure"
  | "error"
  | "inactive";

export type DeploymentVerdict = "healthy" | "improved" | "degraded" | "unknown";

export interface IDeploymentImpactWindow {
  logCount: number;
  errorCount: number;
  errorRate: number;
  avgResponseTime: number | null;
}

export interface IDeploymentImpact {
  verdict: DeploymentVerdict;
  computedAt: Date;
  windowMinutes: number;
  before: IDeploymentImpactWindow;
  after: IDeploymentImpactWindow;
  errorRateChangePct: number | null;
  responseTimeChangePct: number | null;
}

export interface IDeployment extends Document {
  projectId: string;
  /** "deployment" for deploys, "release" for published GitHub releases. */
  kind: "deployment" | "release";
  environment: string;
  /** Version/tag — correlates with the `release` field on ingested logs. */
  release?: string;
  sha?: string;
  status: DeploymentStatus;
  provider: "github" | "api";
  url?: string;
  description?: string;
  githubDeploymentId?: number;
  githubReleaseId?: number;
  deployedBy?: string;
  startedAt: Date;
  finishedAt?: Date;
  impact?: IDeploymentImpact;
  createdAt: Date;
  updatedAt: Date;
}

const ImpactWindowSchema = new Schema<IDeploymentImpactWindow>(
  {
    logCount: { type: Number, required: true },
    errorCount: { type: Number, required: true },
    errorRate: { type: Number, required: true },
    avgResponseTime: { type: Number, default: null },
  },
  { _id: false }
);

const DeploymentSchema: Schema = new Schema<IDeployment>(
  {
    projectId: {
      type: String,
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: ["deployment", "release"],
      default: "deployment",
    },
    environment: {
      type: String,
      required: true,
      default: "production",
    },
    release: {
      type: String,
    },
    sha: {
      type: String,
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "success", "failure", "error", "inactive"],
      default: "success",
    },
    provider: {
      type: String,
      enum: ["github", "api"],
      required: true,
    },
    url: {
      type: String,
    },
    description: {
      type: String,
    },
    githubDeploymentId: {
      type: Number,
    },
    githubReleaseId: {
      type: Number,
    },
    deployedBy: {
      type: String,
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    finishedAt: {
      type: Date,
    },
    impact: {
      verdict: {
        type: String,
        enum: ["healthy", "improved", "degraded", "unknown"],
      },
      computedAt: Date,
      windowMinutes: Number,
      before: ImpactWindowSchema,
      after: ImpactWindowSchema,
      errorRateChangePct: { type: Number, default: null },
      responseTimeChangePct: { type: Number, default: null },
    },
  },
  {
    timestamps: true,
  }
);

DeploymentSchema.index({ projectId: 1, startedAt: -1 });
// Partial, not sparse. A sparse compound index only skips documents missing
// every indexed field, and projectId is always set, so deploys (no release id)
// all shared one null key: the first deploy blocked every later one.
DeploymentSchema.index(
  { projectId: 1, githubDeploymentId: 1 },
  {
    unique: true,
    partialFilterExpression: { githubDeploymentId: { $type: "number" } },
    name: "projectId_githubDeploymentId_unique",
  }
);
DeploymentSchema.index(
  { projectId: 1, githubReleaseId: 1 },
  {
    unique: true,
    partialFilterExpression: { githubReleaseId: { $type: "number" } },
    name: "projectId_githubReleaseId_unique",
  }
);
DeploymentSchema.index({ projectId: 1, release: 1 });

export const DeploymentModel = mongoose.model<IDeployment>(
  "Deployment",
  DeploymentSchema
);

/** The sparse unique indexes the partial ones above replace. */
const LEGACY_INDEXES = [
  "projectId_1_githubDeploymentId_1",
  "projectId_1_githubReleaseId_1",
];

/**
 * Drops the legacy sparse indexes and builds the partial replacements. Safe to
 * run on every boot: it does nothing once the old indexes are gone. Needed
 * because Mongoose never replaces an existing index whose options changed.
 */
export async function repairDeploymentIndexes(): Promise<string[]> {
  const existing = await DeploymentModel.collection
    .indexes()
    .catch(() => [] as Array<{ name?: string }>);
  const dropped: string[] = [];
  for (const index of existing) {
    if (index.name && LEGACY_INDEXES.includes(index.name)) {
      await DeploymentModel.collection.dropIndex(index.name);
      dropped.push(index.name);
    }
  }
  await DeploymentModel.createIndexes();
  return dropped;
}
