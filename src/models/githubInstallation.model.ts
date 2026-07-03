import mongoose, { Schema, Document } from "mongoose";

export interface IGithubInstallation extends Document {
  /** GitHub App installation id. */
  installationId: number;
  /** Login of the user/org the App is installed on. */
  accountLogin: string;
  accountId: number;
  accountType: "User" | "Organization";
  repositorySelection: "all" | "selected";
  /** Populated when repositorySelection === "selected". */
  repositories: Array<{ id: number; fullName: string }>;
  /** Apperio user who initiated the installation (when known). */
  installedByUserId?: mongoose.Types.ObjectId;
  suspended: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const GithubInstallationSchema: Schema = new Schema<IGithubInstallation>(
  {
    installationId: {
      type: Number,
      required: true,
      unique: true,
    },
    accountLogin: {
      type: String,
      required: true,
      index: true,
    },
    accountId: {
      type: Number,
      required: true,
    },
    accountType: {
      type: String,
      enum: ["User", "Organization"],
      required: true,
    },
    repositorySelection: {
      type: String,
      enum: ["all", "selected"],
      default: "selected",
    },
    repositories: {
      type: [
        {
          id: { type: Number, required: true },
          fullName: { type: String, required: true },
          _id: false,
        },
      ],
      default: [],
    },
    installedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    suspended: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

GithubInstallationSchema.index({ "repositories.fullName": 1 });

export const GithubInstallationModel = mongoose.model<IGithubInstallation>(
  "GithubInstallation",
  GithubInstallationSchema
);
