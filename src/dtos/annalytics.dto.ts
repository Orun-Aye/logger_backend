// src/dtos/analytics.dto.ts

export interface ErrorTimelineDTO {
  time: string;
  errors: number;
  warnings: number;
  fatal: number;
}

export interface TopErrorDTO {
  message: string;
  count: number;
  lastSeen: string;
  affectedUsers: number;
  service: string;
  trend: 'up' | 'down' | 'stable';
  hasMultipleStacks: boolean;
}

export interface ErrorDistributionDTO {
  name: string;
  value: number;
  color: string;
}

export interface ErrorStatsDTO {
  totalErrors: number;
  errorRate: number;
  affectedUsers: number;
  mttr: number;
  changes: {
    totalErrors: string;
    errorRate: string;
    affectedUsers: string;
    mttr: string;
  };
}

export interface PerformanceTimelineDTO {
  time: string;
  lcp: number;
  fcp: number;
  ttfb: number;
  cls: number;
}

export interface WebVitalsDTO {
  lcp: {
    p75: number;
    avg: number;
  };
  fcp: {
    p75: number;
    avg: number;
  };
  cls: {
    p75: number;
    avg: number;
  };
}

export interface ResourcePerformanceDTO {
  name: string;
  calls: number;
  avgDuration: number;
  p95: number;
  p99: number;
  errors: number;
}

export interface PagePerformanceDTO {
  page: string;
  views: number;
  loadTime: number;
  fcp: number;
  lcp: number;
  cls: number;
}

export interface PerformanceScoreDTO {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F' | 'N/A';
  breakdown: {
    loadTime: { score: number; value: number };
    lcp: { score: number; value: number };
    fcp: { score: number; value: number };
    cls: { score: number; value: string };
  };
}

export interface ActivityFeedFiltersDTO {
  page: number;
  limit: number;
  level?: string;
  eventType?: string;
  service?: string;
  environment?: string;
  search?: string;
}

export interface ActivityStatsDTO {
  [level: string]: number;
}

export interface FilterValuesDTO {
  levels: string[];
  eventTypes: string[];
  services: string[];
  environments: string[];
}

export interface SessionDTO {
  id: string;
  userId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  pageViews: number;
  events: number;
  hasErrors: boolean;
  device?: string;
  browser?: string;
  country?: string;
  entryPage?: string;
  exitPage?: string;
}

export interface SessionTimelineEventDTO {
  type: string;
  timestamp: Date;
  level?: string;
  message?: string;
  url?: string;
  data?: any;
  error?: any;
}

export interface SessionStatsDTO {
  totalSessions: number;
  avgDuration: number;
  avgPageViews: number;
  sessionsWithErrors: number;
}

export interface UserJourneyDTO {
  journey: string[];
  count: number;
}

export interface DashboardOverviewDTO {
  errors: ErrorStatsDTO;
  performance: PerformanceScoreDTO;
  activity: ActivityStatsDTO;
  sessions: SessionStatsDTO;
}

export interface AlertDTO {
  id: string;
  severity: string;
  message: string;
  timestamp: string;
  status: 'active' | 'resolved';
  service: string;
  environment: string;
}