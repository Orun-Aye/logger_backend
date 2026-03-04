export interface FunnelStep {
  name: string;
  eventType?: string;
  url?: string;
  message?: string;
  level?: string;
}

export interface FunnelOptions {
  timeRange?: string;
  environment?: string;
}

export interface FunnelStepResult {
  name: string;
  count: number;
  dropoff: number;
  dropoffRate: number;
  conversionRate: number;
}

export interface FunnelResult {
  steps: FunnelStepResult[];
  totalSessions: number;
  completionRate: number;
}
