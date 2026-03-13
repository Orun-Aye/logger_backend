import mongoose, { Document, Schema } from "mongoose";

export type WaitlistStatus = "pending" | "approved" | "rejected";

export interface IWaitlistEntry extends Document {
  email: string;
  position: number;
  referralCode: string;
  status: WaitlistStatus;
  inviteCode: string | null;
  approvedAt: Date | null;
  invitedAt: Date | null;
  signedUpAt: Date | null;
  createdAt: Date;
}

const WaitlistSchema: Schema<IWaitlistEntry> = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  position: { type: Number, required: true },
  referralCode: { type: String, required: true, unique: true },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  inviteCode: { type: String, default: null, unique: true, sparse: true },
  approvedAt: { type: Date, default: null },
  invitedAt: { type: Date, default: null },
  signedUpAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

WaitlistSchema.index({ email: 1 }, { unique: true });
WaitlistSchema.index({ position: 1 });
WaitlistSchema.index({ status: 1 });
WaitlistSchema.index({ inviteCode: 1 }, { unique: true, sparse: true });

export const WaitlistModel = mongoose.model<IWaitlistEntry>(
  "WaitlistEntry",
  WaitlistSchema
);
