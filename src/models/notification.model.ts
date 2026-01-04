import mongoose, { Schema, Document } from "mongoose";

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: "info" | "warning" | "error" | "success";
  message: string;
  read: boolean;
  metadata?: any;
  createdAt: Date;
}

const NotificationSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  type: {
    type: String,
    enum: ["info", "warning", "error", "success"],
    default: "info",
  },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  metadata: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<INotification>(
  "Notification",
  NotificationSchema
);
