import { runRetentionJob } from "./retention.job";
import logger from "../utils/logger";

let retentionInterval: NodeJS.Timeout | null = null;

/**
 * Initialize all background jobs.
 * Only call this in standalone server mode (not Vercel serverless).
 */
export function initializeJobs(config: { retention: { enabled: boolean; cronSchedule: string } }): void {
  logger.info("Initializing background jobs...");

  if (config.retention.enabled) {
    // Parse cron schedule to interval (simplified: run daily)
    // For production, consider using node-cron package
    // Using setInterval for simplicity (runs every 24 hours)
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

    retentionInterval = setInterval(async () => {
      await runRetentionJob();
    }, TWENTY_FOUR_HOURS);

    logger.info("RetentionJob: Scheduled (every 24 hours)");
  }

  logger.info("Background jobs initialized");
}

/**
 * Stop all background jobs gracefully
 */
export function stopJobs(): void {
  if (retentionInterval) {
    clearInterval(retentionInterval);
    retentionInterval = null;
  }
  logger.info("Background jobs stopped");
}
