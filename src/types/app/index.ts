// Types and Interfaces

import { LogLevel } from "../../services/log.service";



/**
 * Options for querying dashboard insights.
 * This is now largely replaced by GetInsightsDTO, but kept for internal service use.
 */
export interface InsightsOptions {
  range?: '1d' | '7d' | '30d' | 'custom' | '24h' | '1h' | '1w' | '4w' | '1m' | '3m' | '6m' | '1y';
  from?: string;
  to?: string;
  severity?: LogLevel;
  timezone?: string;
}

/**
 * Represents a date range with 'from' and 'to' dates.
 */
export interface DateRange {
  from: Date;
  to: Date;
}

/**
 * Summary statistics for logs.
 */
export interface SummaryData {
  totalLogs: number;
  totalUniqueEndpoints: number;
  averageLogsPerDay: number;
  errorRate: number; // Percentage
}

/**
 * Breakdown of log counts by severity level.
 */
export interface SeverityBreakdown {
  info: number;
  warn: number;
  error: number;
  critical: number;
  trace?: number;
  debug?: number;
  fatal?: number;
}

/**
 * Data point for time series graphs.
 */
export interface TimeSeriesDataPoint {
  date: string; // YYYY-MM-DD
  timestamp: string; // ISO string for the start of the day
  totalCount: number;
  severityBreakdown: SeverityBreakdown;
}

/**
 * Data for top endpoints.
 */
export interface EndpointData {
  path: string;
  method: string;
  totalCount: number;
  errorCount: number;
  errorRate: number;
  avgResponseTime: number | null;
}

/**
 * Data for frequent error messages.
 */
export interface FrequentErrorMessage {
  message: string;
  count: number;
  firstSeen: string; // ISO string
  lastSeen: string;  // ISO string
  affectedEndpoints: string[];
}

/**
 * Data for error trends (current vs previous period).
 */
export interface ErrorTrends {
  currentPeriod: number;
  previousPeriod: number;
  percentageChange: number; // Percentage change
}

/**
 * Comprehensive error analysis data.
 */
export interface ErrorAnalysis {
  frequentErrorMessages: FrequentErrorMessage[];
  errorTrends: ErrorTrends;
}

/**
 * Data for a recent critical error.
 */
export interface RecentCriticalError {
  timestamp: string; // ISO string
  message: string;
  endpoint?: string;
  count: number;
}

export interface LatestLog {
  timestamp: string;
  message: string;
  level: string;
  context: Record<string, any>;
}

/**
 * Data for recent activity.
 */
export interface RecentActivity {
  latestLog: LatestLog | null;
  recentCriticalErrors: RecentCriticalError[];
}

export interface InsightsMeta {
  generatedAt?: string;
  queryExecutionTime?: number;
  cached: boolean;
  cacheExpiresAt?: string;
  timeRange?: {
    from: string;
    to: string;
    range: InsightsOptions['range'];
  }
}

export interface DashboardInsights {
  projectId: string;
  timeRange: {
    from: Date;
    to: Date;
    range: InsightsOptions['range'];
  };
  summary: SummaryData;
  logCountBySeverity: SeverityBreakdown;
  timeSeriesData: TimeSeriesDataPoint[];
  topEndpoints: EndpointData[];
  errorAnalysis: ErrorAnalysis;
  recentActivity: RecentActivity;
  meta?: InsightsMeta;
}
