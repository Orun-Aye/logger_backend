import mongoose, { Schema, Document } from "mongoose";

export type ErrorGroupStatus = "unresolved" | "resolved" | "ignored";

export interface ILinkedIssue {
  provider: "github";
  repo: string;
  number: number;
  url: string;
  state: "open" | "closed";
  linkedAt: Date;
  linkedBy?: mongoose.Types.ObjectId;
}

export interface ISuspectCommit {
  sha: string;
  score: number;
  rationale?: string;
  message?: string;
  htmlUrl?: string;
  authorLogin?: string;
}

export interface IErrorGroup extends Document {
  projectId: string;
  /** Stable hash of the normalized error signature. */
  fingerprint: string;
  /** Human-readable group title, e.g. "TypeError: Cannot read properties of undefined". */
  title: string;
  errorName?: string;
  sampleMessage: string;
  sampleStack?: string;
  /** Most recent log document carrying this error. */
  sampleLogId?: string;
  firstSeen: Date;
  lastSeen: Date;
  count: number;
  /** Approximate distinct sessions affected (capped rolling sample). */
  sessionCount: number;
  sessionSample: string[];
  environments: string[];
  services: string[];
  /** Release the group was first/last observed in (from Log.release). */
  releaseFirstSeen?: string;
  releaseLastSeen?: string;
  status: ErrorGroupStatus;
  resolvedAt?: Date;
  /** User id, or "github" when resolved by closing the linked issue. */
  resolvedBy?: string;
  /** Set when a resolved group receives new events. */
  regressed: boolean;
  regressedAt?: Date;
  lastNotifiedAt?: Date;
  aiSummary?: string;
  linkedIssue?: ILinkedIssue;
  suspectCommits?: ISuspectCommit[];
  suspectCommitsComputedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LinkedIssueSchema = new Schema<ILinkedIssue>(
  {
    provider: { type: String, enum: ["github"], required: true },
    repo: { type: String, required: true },
    number: { type: Number, required: true },
    url: { type: String, required: true },
    state: { type: String, enum: ["open", "closed"], default: "open" },
    linkedAt: { type: Date, default: Date.now },
    linkedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { _id: false }
);

const SuspectCommitSchema = new Schema<ISuspectCommit>(
  {
    sha: { type: String, required: true },
    score: { type: Number, required: true },
    rationale: { type: String },
    message: { type: String },
    htmlUrl: { type: String },
    authorLogin: { type: String },
  },
  { _id: false }
);

const ErrorGroupSchema: Schema = new Schema<IErrorGroup>(
  {
    projectId: {
      type: String,
      required: true,
      index: true,
    },
    fingerprint: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    errorName: {
      type: String,
    },
    sampleMessage: {
      type: String,
      required: true,
    },
    sampleStack: {
      type: String,
    },
    sampleLogId: {
      type: String,
    },
    firstSeen: {
      type: Date,
      required: true,
      default: Date.now,
    },
    lastSeen: {
      type: Date,
      required: true,
      default: Date.now,
    },
    count: {
      type: Number,
      default: 1,
    },
    sessionCount: {
      type: Number,
      default: 0,
    },
    sessionSample: {
      type: [String],
      default: [],
    },
    environments: {
      type: [String],
      default: [],
    },
    services: {
      type: [String],
      default: [],
    },
    releaseFirstSeen: {
      type: String,
    },
    releaseLastSeen: {
      type: String,
    },
    status: {
      type: String,
      enum: ["unresolved", "resolved", "ignored"],
      default: "unresolved",
    },
    resolvedAt: {
      type: Date,
    },
    resolvedBy: {
      type: String,
    },
    regressed: {
      type: Boolean,
      default: false,
    },
    regressedAt: {
      type: Date,
    },
    lastNotifiedAt: {
      type: Date,
    },
    aiSummary: {
      type: String,
    },
    linkedIssue: {
      type: LinkedIssueSchema,
      default: undefined,
    },
    suspectCommits: {
      type: [SuspectCommitSchema],
      default: undefined,
    },
    suspectCommitsComputedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

ErrorGroupSchema.index({ projectId: 1, fingerprint: 1 }, { unique: true });
ErrorGroupSchema.index({ projectId: 1, lastSeen: -1 });
ErrorGroupSchema.index({ projectId: 1, status: 1, lastSeen: -1 });
ErrorGroupSchema.index({ projectId: 1, count: -1 });
ErrorGroupSchema.index({
  "linkedIssue.repo": 1,
  "linkedIssue.number": 1,
});

export const ErrorGroupModel = mongoose.model<IErrorGroup>(
  "ErrorGroup",
  ErrorGroupSchema
);
