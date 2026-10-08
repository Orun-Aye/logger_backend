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
  integrationSettings?: {
    slack?: { webhookUrl?: string };
    email?: { recipients?: string[] };
    webhook?: { url?: string; headers?: Record<string, string> };
    githubRepo?: {
      owner: string;
      repo: string;
      branch: string;
      linkedAt: Date;
      linkedBy: Types.ObjectId;
    };
  };
  notificationSettings?: {
    errorGroups?: {
      /** Owner notifications (in-app + email) for new/regressed error groups. */
      enabled?: boolean;
      /** Environments that trigger notifications. Empty = all environments. */
      environments?: string[];
    };
  };
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
  archivedAt?: Date;
  archiveReason?: string;
  organizationId?: Types.ObjectId;
  createdAt: Date;
  updatedAt?: Date;
}

const ProjectSchema: Schema<IProject> = new Schema(
  {
    _id: { type: Schema.Types.ObjectId, auto: true },
    // Unique per owner (compound index below), not across every account
    name: { type: String, required: true },
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
    integrationSettings: {
      slack: { webhookUrl: { type: String, default: "" } },
      email: { recipients: { type: [String], default: [] } },
      webhook: {
        url: { type: String, default: "" },
        headers: { type: Schema.Types.Mixed, default: {} },
      },
      githubRepo: {
        type: {
          owner: { type: String, required: true },
          repo: { type: String, required: true },
          branch: { type: String, required: true, default: "main" },
          linkedAt: { type: Date, default: Date.now },
          linkedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
        },
        required: false,
        default: undefined,
      },
    },
    notificationSettings: {
      errorGroups: {
        enabled: { type: Boolean, default: true },
        environments: { type: [String], default: ["production"] },
      },
    },
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
    archivedAt: { type: Date },
    archiveReason: { type: String },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
  },
  {
    timestamps: true,
  }
);

// Index for organization-scoped queries (sparse because field is optional)
ProjectSchema.index({ organizationId: 1 }, { sparse: true });

// One owner cannot have two projects with the same name; different owners can
ProjectSchema.index({ ownerId: 1, name: 1 }, { unique: true, name: "ownerId_name_unique" });

export const ProjectModel = model<IProject>("Project", ProjectSchema);

/** The global unique index on name that the per-owner index above replaces. */
const LEGACY_NAME_INDEX = "name_1";

/**
 * Drops the global unique name index and builds the per-owner one. Safe to run
 * on every boot: it does nothing once the old index is gone. Needed because
 * Mongoose never drops an index that left the schema.
 */
export async function repairProjectNameIndexes(): Promise<string[]> {
  const existing = await ProjectModel.collection
    .indexes()
    .catch(() => [] as Array<{ name?: string }>);
  const dropped: string[] = [];
  if (existing.some((index) => index.name === LEGACY_NAME_INDEX)) {
    await ProjectModel.collection.dropIndex(LEGACY_NAME_INDEX);
    dropped.push(LEGACY_NAME_INDEX);
  }
  await ProjectModel.createIndexes();
  return dropped;
}