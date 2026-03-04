export interface RegressionOptions {
  currentPeriod?: string;
  baselinePeriod?: string;
  threshold?: number;
  metrics?: string[];
}

export interface MetricComparison {
  metric: string;
  currentValue: number;
  baselineValue: number;
  percentChange: number;
  standardDeviations: number;
  status: "improved" | "degraded" | "stable";
  severity: "critical" | "warning" | "normal";
}

export interface RegressionResult {
  regressions: MetricComparison[];
  summary: {
    totalMetrics: number;
    degradedCount: number;
    improvedCount: number;
    stableCount: number;
  };
}

export interface PerformanceBaseline {
  metric: string;
  mean: number;
  stdDev: number;
  p50: number;
  p95: number;
  p99: number;
  sampleSize: number;
}
