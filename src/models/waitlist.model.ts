import mongoose, { Document, Schema } from "mongoose";

export interface IWaitlistEntry extends Document {
  email: string;
  position: number;
  referralCode: string;
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
  createdAt: { type: Date, default: Date.now },
});

WaitlistSchema.index({ email: 1 }, { unique: true });
WaitlistSchema.index({ position: 1 });

export const WaitlistModel = mongoose.model<IWaitlistEntry>(
  "WaitlistEntry",
  WaitlistSchema
);
