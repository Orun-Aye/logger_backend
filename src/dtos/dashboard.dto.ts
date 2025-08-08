import { LogLevel } from "./log.dto";


/**
 * DTO for querying dashboard insights.
 * Represents the parameters expected in the request query for fetching insights.
 */
export interface GetInsightsDTO {
  /**
   * The predefined time range for insights (e.g., '1d', '7d', '30d', 'custom').
   * Default: '7d'
   */
  range?: '1d' | '7d' | '30d' | 'custom' | '24h' | '1h' | '1w' | '4w' | '1m' | '3m' | '6m' | '1y';
  /**
   * Start date for a custom time range (ISO 8601 string). Required if range is 'custom'.
   */
  from?: string;
  /**
   * End date for a custom time range (ISO 8601 string). Required if range is 'custom'.
   */
  to?: string;
  /**
   * Optional filter for log severity (e.g., 'error', 'warn').
   */
  severity?: LogLevel; // Using LogLevel enum for severity
  /**
   * Optional timezone for date aggregation (e.g., 'UTC', 'America/New_York').
   * Default: 'UTC'
   */
  timezone?: string;
}
