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
    url?: string;              
    lineNumber?: number;       
    columnNumber?: number;     
  };
  service?: string;
  environment?: string;
  context?: Record<string, any>;
  metadata?: any;
  eventType?: 'error' | 'performance' | 'interaction' | 'network' | 'console' | 'pageview';
  userAgent?: string;
  url?: string;
  referrer?: string;
  createdAt?: Date;
  updatedAt?: Date;
  ingestionStartTime?: Date;
  ingestionEndTime?: Date;
  responseTime?: number;
  ingestionSuccess?: boolean;
}

const LogSchema: Schema = new Schema<ILog>(
  {
    projectId: {
      type: String,
      required: true,
      index: true,
    },
    timestamp: {
      type: String,
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
      url: String,              
      lineNumber: Number,       
      columnNumber: Number,     
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
    eventType: {
      type: String,
      enum: ['error', 'performance', 'interaction', 'network', 'console', 'pageview'],
      index: true, // Good for filtering by event type
    },
    userAgent: {
      type: String,
    },
    url: {
      type: String,
      index: true, // Good for filtering by URL
    },
    referrer: {
      type: String,
    },
    ingestionStartTime: {
      type: Date,
    },
    ingestionEndTime: {
      type: Date,
    },
    responseTime: {
      type: Number,
      min: 0,
    },
    ingestionSuccess: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  },
);

// ✅ ADDED - Additional indexes for better query performance
LogSchema.index({ projectId: 1, timestamp: -1 }); // Common query pattern
LogSchema.index({ projectId: 1, level: 1 }); // Filter by project and log level
LogSchema.index({ projectId: 1, eventType: 1 }); // Filter by project and event type
LogSchema.index({ url: 1, timestamp: -1 }); // URL-based queries with recency
LogSchema.index({ projectId: 1, responseTime: 1 }); // For response time queries
LogSchema.index({ projectId: 1, ingestionEndTime: -1 }); // For recent response time analysis

export const LogModel = mongoose.model<ILog>("Log", LogSchema);