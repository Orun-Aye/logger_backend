import mongoose, { Document, Schema } from "mongoose";
import { IProject } from "./project.model";

export enum LogLevel {
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
  DEBUG = "debug",
}

export interface ILog extends Document {
  level: LogLevel;
  message: string;
  projectId: mongoose.Types.ObjectId | IProject;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const LogSchema: Schema<ILog> = new Schema(
  {
    level: { type: String, enum: Object.values(LogLevel), required: true },
    message: { type: String, required: true },
    
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  }
);

LogSchema.index({ project: 1, level: 1, createdAt: -1 });

export const Log = mongoose.model<ILog>("Log", LogSchema);