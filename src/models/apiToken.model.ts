import mongoose, { Document, Schema } from "mongoose";

export type ApiTokenScope =
  | "read:logs"
  | "write:logs"
  | "read:projects"
  | "write:projects"
  | "read:alerts"
  | "write:alerts"
  | "admin";

export const API_TOKEN_SCOPES: ApiTokenScope[] = [
  "read:logs",
  "write:logs",
  "read:projects",
  "write:projects",
  "read:alerts",
  "write:alerts",
  "admin",
];

export interface IApiToken extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  tokenHash: string;
  tokenPrefix: string;
  scopes: ApiTokenScope[];
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ApiTokenSchema: Schema<IApiToken> = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    tokenPrefix: {
      type: String,
      required: true,
    },
    scopes: [
      {
        type: String,
        enum: API_TOKEN_SCOPES,
      },
    ],
    expiresAt: {
      type: Date,
      default: null,
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for token lookup during authentication
ApiTokenSchema.index({ tokenHash: 1, isActive: 1 });

// TTL index: automatically remove expired tokens after 30 days past expiration
ApiTokenSchema.index(
  { expiresAt: 1 },
  {
    expireAfterSeconds: 30 * 24 * 60 * 60, // 30 days after expiresAt
    partialFilterExpression: { expiresAt: { $ne: null } },
  }
);

export const ApiTokenModel = mongoose.model<IApiToken>(
  "ApiToken",
  ApiTokenSchema
);
