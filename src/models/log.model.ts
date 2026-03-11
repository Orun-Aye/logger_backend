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
  eventType?: 'error' | 'performance' | 'interaction' | 'network' | 'console' | 'pageview' | 'web-vital' | 'breadcrumb' | 'message' | 'system';
  userAgent?: string;
  url?: string;
  referrer?: string;
  correlationId?: string; // For distributed tracing
  sessionId?: string; // For session grouping
  traceId?: string; // SDK Phase 2: Distributed tracing
  spanId?: string; // SDK Phase 2: Distributed tracing
  release?: string; // SDK Phase 2: Release/version tracking
  createdAt?: Date;
  updatedAt?: Date;
  ingestionStartTime?: Date;
  ingestionEndTime?: Date;
  ingestionLatency?: number;
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
      enum: ['error', 'performance', 'interaction', 'network', 'console', 'pageview', 'web-vital', 'breadcrumb', 'message', 'system'],
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
    correlationId: {
      type: String,
      index: true, // For distributed tracing queries
    },
    sessionId: {
      type: String,
      index: true, // For session-based queries
    },
    traceId: {
      type: String,
      index: true, // SDK Phase 2: Distributed tracing queries
    },
    spanId: {
      type: String,
    },
    release: {
      type: String,
      index: true, // SDK Phase 2: Filter/group by release version
    },
    ingestionStartTime: {
      type: Date,
    },
    ingestionEndTime: {
      type: Date,
    },
    ingestionLatency: {
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
LogSchema.index({ projectId: 1, ingestionEndTime: -1 }); // For recent response time analysis
LogSchema.index({ correlationId: 1, timestamp: -1 }); // Distributed tracing queries
LogSchema.index({ sessionId: 1, timestamp: -1 }); // Session-based queries
LogSchema.index({ projectId: 1, correlationId: 1 }); // Project + correlation
LogSchema.index({ projectId: 1, sessionId: 1 }); // Project + session
LogSchema.index({ traceId: 1, timestamp: -1 }); // SDK Phase 2: Trace-based queries
LogSchema.index({ projectId: 1, traceId: 1 }); // SDK Phase 2: Project + trace
LogSchema.index({ projectId: 1, release: 1, timestamp: -1 }); // SDK Phase 2: Release tracking
LogSchema.index({ projectId: 1, eventType: 1, timestamp: -1 }); // Web vitals time queries

export const LogModel = mongoose.model<ILog>("Log", LogSchema);