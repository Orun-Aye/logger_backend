import mongoose, { Schema, Document } from "mongoose";


export interface ILog extends Document {
  projectId: string;
  timestamp: string;
  level: string;
  message: string;
  data?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  service?: string;
  environment?: string;
  context?: Record<string, any>;
  metadata?: any;
  createdAt?: Date;
  updatedAt?: Date;
}

const LogSchema: Schema = new Schema<ILog>(
  {
    projectId: {
      type: String,
      required: true,
      index: true,
    },
    timestamp: {
      type: String, // ISO 8601 string
      required: true,
      default: () => new Date().toISOString(),
    },
    level: {
      type: String,
      required: true,
      enum: ["trace", "debug", "info", "warn", "error", "fatal"],
    },
    message: {
      type: String,
      required: true,
    },
    data: {
      type: Schema.Types.Mixed,
    },
    error: {
      name: String,
      message: String,
      stack: String,
    },
    service: {
      type: String,
      default: "unknown-service",
    },
    environment: {
      type: String,
      default: "development",
    },
    context: {
      type: Schema.Types.Mixed,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

export const LogModel = mongoose.model<ILog>("Log", LogSchema);
