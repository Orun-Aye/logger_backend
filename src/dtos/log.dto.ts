// src/dtos/log.dto.ts

// Defining DTOs and Enums here for completeness and clarity,
// assuming they are also defined in a separate log.dto.ts file.
// If they are strictly in log.dto.ts, these can be removed from here.

export enum LogLevel {
  TRACE = "trace",
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
  FATAL = "fatal",
}

/**
 * @description DTO for creating a new log entry
 */
export interface CreateLogDTO {
  projectId: string;
  timestamp?: Date | string | number;
  level: LogLevel;
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
  eventType?:
    | "error"
    | "performance"
    | "interaction"
    | "network"
    | "console"
    | "pageview";
  userAgent?: string;
  url?: string;
  referrer?: string;
}

/**
 * @description DTO for filtering logs via query params
 */
export interface FilterLogsDTO {
  projectId?: string; // Made optional here, but will be enforced in methods that need it
  level?: LogLevel;
  levels?: LogLevel[]; // Support multiple levels
  service?: string;
  services?: string[]; // Support multiple services
  environment?: string;
  search?: string; // for message
  startDate?: Date;
  endDate?: Date;
  eventType?:
    | "error"
    | "performance"
    | "interaction"
    | "network"
    | "console"
    | "pageview";
  userAgent?: string;
  url?: string;
  referrer?: string;
  errorName?: string; // Filter by error.name
  errorMessage?: string; // Filter by error.message regex

  page?: number;
  limit?: number;
  sortBy?: LogSortByField;
  sortOrder?: "asc" | "desc";
}

export interface LogSummaryData {
  totalLogs: number;
  byLevel: Record<LogLevel, number>;
  byService: Record<string, number>;
  byEnvironment: Record<string, number>;
  byEventType: Record<string, number>;
  topErrorMessages?: Array<{
    message: string;
    count: number;
    lastSeen?: string;
  }>; // Added lastSeen
  recentLogCount?: number;
  logTrends?: Array<{
    _id: string;
    count: number;
    errorCount?: number;
    warnCount?: number;
  }>;
  metadata: {
    projectId: string | null;
    filters: Omit<FilterLogsDTO, "page" | "limit" | "sortBy" | "sortOrder">;
    generatedAt: Date;
    responseTime?: number;
  };
}

export type LogSortByField =
  | "timestamp"
  | "level"
  | "service"
  | "environment"
  | "createdAt"
  | "updatedAt"
  | "eventType"
  | "url";

export interface ResponseTimeMetrics {
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  totalRequests: number;
  successRate: number;
  p50: number;
  p95: number;
  p99: number;
}
