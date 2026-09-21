import mongoose, { Schema, Document } from "mongoose";

/**
 * Short-lived, single-use `state` tokens for the two GitHub browser
 * round-trips: the integration OAuth dance and the App installation.
 *
 * These used to be in-process `Map`s. That broke in two ways on Render:
 * a restart between minting and redeeming silently invalidated the state,
 * and a state minted by a localhost backend could never be redeemed by the
 * production callback (GitHub only allows one callback/setup URL, which
 * points at production). Both failures were indistinguishable from an
 * expired token.
 *
 * Documents delete themselves via a TTL index on `expiresAt`; redemption
 * deletes them immediately, which is what makes them single use.
 */
export interface IGithubOAuthState extends Document {
  /** Opaque CSRF token echoed back by GitHub. */
  state: string;
  /** Which flow minted it. */
  kind: "oauth" | "install";
  /** Apperio user who started it. Absent for an anonymous App install. */
  userId?: mongoose.Types.ObjectId;
  /** Where to send the browser once the round-trip completes. */
  returnTo?: string;
  expiresAt: Date;
  createdAt: Date;
}

const GithubOAuthStateSchema: Schema = new Schema<IGithubOAuthState>(
  {
    state: {
      type: String,
      required: true,
      unique: true,
    },
    kind: {
      type: String,
      enum: ["oauth", "install"],
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    returnTo: {
      type: String,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Mongo's TTL monitor removes documents once `expiresAt` is in the past.
GithubOAuthStateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const GithubOAuthStateModel = mongoose.model<IGithubOAuthState>(
  "GithubOAuthState",
  GithubOAuthStateSchema
);
