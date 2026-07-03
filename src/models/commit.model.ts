import mongoose, { Schema, Document } from "mongoose";

export type AiSummaryStatus = "pending" | "complete" | "skipped" | "failed";

export interface ICommitFile {
  filename: string;
  status: "added" | "modified" | "removed" | "renamed" | "changed" | "copied" | "unchanged";
  additions?: number;
  deletions?: number;
}

export interface ICommit extends Document {
  projectId: string;
  sha: string;
  message: string;
  authorName: string;
  authorEmail?: string;
  authorLogin?: string;
  authorAvatarUrl?: string;
  committedAt: Date;
  branch?: string;
  htmlUrl?: string;
  additions?: number;
  deletions?: number;
  filesChanged?: number;
  /** Capped file list (no patches are persisted — diffs are fetched on demand). */
  files?: ICommitFile[];
  /** Groups commits delivered in the same push webhook. */
  pushId?: string;
  /** Plain-English summary for non-technical readers. */
  aiSummary?: string;
  /** Developer-facing summary with technical detail. */
  aiTechnicalSummary?: string;
  /** Longer on-demand explanation ("Explain this change"). */
  aiExplanation?: string;
  aiSummaryStatus: AiSummaryStatus;
  source: "webhook" | "backfill";
  createdAt: Date;
  updatedAt: Date;
}

const CommitFileSchema = new Schema<ICommitFile>(
  {
    filename: { type: String, required: true },
    status: { type: String, required: true },
    additions: { type: Number },
    deletions: { type: Number },
  },
  { _id: false }
);

const CommitSchema: Schema = new Schema<ICommit>(
  {
    projectId: {
      type: String,
      required: true,
      index: true,
    },
    sha: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    authorName: {
      type: String,
      required: true,
    },
    authorEmail: {
      type: String,
    },
    authorLogin: {
      type: String,
    },
    authorAvatarUrl: {
      type: String,
    },
    committedAt: {
      type: Date,
      required: true,
    },
    branch: {
      type: String,
    },
    htmlUrl: {
      type: String,
    },
    additions: {
      type: Number,
    },
    deletions: {
      type: Number,
    },
    filesChanged: {
      type: Number,
    },
    files: {
      type: [CommitFileSchema],
      default: undefined,
    },
    pushId: {
      type: String,
    },
    aiSummary: {
      type: String,
    },
    aiTechnicalSummary: {
      type: String,
    },
    aiExplanation: {
      type: String,
    },
    aiSummaryStatus: {
      type: String,
      enum: ["pending", "complete", "skipped", "failed"],
      default: "pending",
    },
    source: {
      type: String,
      enum: ["webhook", "backfill"],
      default: "webhook",
    },
  },
  {
    timestamps: true,
  }
);

// One document per commit per project (a repo can be linked to several projects)
CommitSchema.index({ projectId: 1, sha: 1 }, { unique: true });
CommitSchema.index({ projectId: 1, committedAt: -1 });
CommitSchema.index({ projectId: 1, aiSummaryStatus: 1 });

export const CommitModel = mongoose.model<ICommit>("Commit", CommitSchema);
