// Types and Interfaces

import { LogLevel } from "../../dtos/log.dto";
import { ProjectsSummaryData } from "../../services/project.service";




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


export interface SystemMetricsData {
  totalLogs: number;
  totalProjects: number;
  totalActiveErrors: number;
  averageResponseTime: number;
  systemLoad: {
    cpu: number[];
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    uptime: number;
  };
  storageUsed: {
    database: number;
    logs: number;
    estimated: string;
  };
  averageUptime: number;
  projectsHealth: {
    healthy: number;
    degraded: number;
    critical: number;
  };
  metadata: {
    generatedAt: Date;
    responseTime: number;
    nodeVersion: string;
    platform: string;
  };
}

// Chart and analytics interfaces
export interface LogVolumeChartData {
  timePoints: Array<{
    timestamp: string;
    totalLogs: number;
    errorLogs: number;
    warnLogs: number;
    infoLogs: number;
    debugLogs: number;
  }>;
  metadata: {
    timeRange: string;
    granularity: "hour" | "day" | "week" | "month";
    totalDataPoints: number;
  };
}

export interface ErrorDistributionData {
  byLevel: Array<{
    level: string;
    count: number;
    percentage: number;
  }>;
  byProject: Array<{
    projectId: string;
    projectName: string;
    errorCount: number;
    errorRate: number;
  }>;
  byService: Array<{
    service: string;
    errorCount: number;
    projects: string[];
  }>;
  topErrorMessages: Array<{
    message: string;
    count: number;
    firstSeen: Date;
    lastSeen: Date;
    affectedProjects: number;
  }>;
}

export interface ProjectHealthData {
  projectId: string;
  projectName: string;
  uptime: {
    percentage: number;
    totalTime: number;
    downtime: number;
    lastIncident: Date | null;
  };
  errorRate: {
    current: number;
    trend: "increasing" | "decreasing" | "stable";
    weeklyAverage: number;
  };
  responseTime: {
    current: number;
    p95: number;
    p99: number;
    trend: "improving" | "degrading" | "stable";
  };
  healthStatus: "healthy" | "warning" | "critical" | "unknown";
  lastHealthCheck: Date;
  alerts: Array<{
    type: "error_rate" | "response_time" | "uptime";
    severity: "low" | "medium" | "high";
    message: string;
    timestamp: Date;
  }>;
}

export interface ServicePerformanceData {
  serviceName: string;
  metrics: {
    requestCount: number;
    errorCount: number;
    averageResponseTime: number;
    throughput: number;
    availability: number;
  };
  trends: {
    responseTime: Array<{
      timestamp: string;
      value: number;
    }>;
    errorRate: Array<{
      timestamp: string;
      value: number;
    }>;
  };
  topEndpoints: Array<{
    endpoint: string;
    hitCount: number;
    avgResponseTime: number;
    errorRate: number;
  }>;
}

export interface UsageStatisticsData {
  overview: {
    totalApiCalls: number;
    totalProjects: number;
    activeUsers: number;
    dataIngested: number; // in MB
  };
  trends: {
    dailyApiCalls: Array<{
      date: string;
      count: number;
    }>;
    projectGrowth: Array<{
      date: string;
      count: number;
    }>;
    userActivity: Array<{
      date: string;
      activeUsers: number;
    }>;
  };
  topConsumers: {
    projects: Array<{
      projectId: string;
      projectName: string;
      apiCalls: number;
      dataUsage: number;
    }>;
    users: Array<{
      userId: string;
      userName: string;
      projectsOwned: number;
      totalApiCalls: number;
    }>;
  };
}

// Enhanced projects summary with new metrics
export interface EnhancedProjectsSummaryData extends ProjectsSummaryData {
  systemMetrics: {
    totalActiveErrors: number;
    averageResponseTime: number;
    systemLoad: number;
    storageUsed: number;
    averageUptime: number;
  };
  errorTrends: Array<{
    _id: string;
    count: number;
    level: string;
  }>;
  performanceMetrics: {
    slowestProjects: Array<{
      projectId: string;
      name: string;
      avgResponseTime: number;
    }>;
    mostActiveProjects: Array<{
      projectId: string;
      name: string;
      recentLogsCount: number;
    }>;
  };
}
