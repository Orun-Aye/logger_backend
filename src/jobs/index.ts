import { runRetentionJob } from "./retention.job";
import { runAnomalyScanJob } from "./anomaly-scan.job";
import { runKeepAliveJob } from "./keep-alive.job";
import logger from "../utils/logger";

let retentionInterval: NodeJS.Timeout | null = null;
let anomalyScanInterval: NodeJS.Timeout | null = null;
let keepAliveInterval: NodeJS.Timeout | null = null;

/**
 * Initialize all background jobs.
 * Only call this in standalone server mode (not Vercel serverless).
 */
export function initializeJobs(config: {
  retention: { enabled: boolean; cronSchedule: string };
  features?: { anomalyDetection?: boolean };
  keepAlive?: { enabled: boolean; url: string; intervalMs: number };
}): void {
  logger.info("Initializing background jobs...");

  if (config.retention.enabled) {
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

    retentionInterval = setInterval(async () => {
      await runRetentionJob();
    }, TWENTY_FOUR_HOURS);

    logger.info("RetentionJob: Scheduled (every 24 hours)");
  }

  if (config.features?.anomalyDetection) {
    const FIVE_MINUTES = 5 * 60 * 1000;

    anomalyScanInterval = setInterval(async () => {
      await runAnomalyScanJob();
    }, FIVE_MINUTES);

    logger.info("AnomalyScanJob: Scheduled (every 5 minutes)");
  }

  if (config.keepAlive?.enabled && config.keepAlive.url) {
    const { url, intervalMs } = config.keepAlive;

    keepAliveInterval = setInterval(async () => {
      await runKeepAliveJob(url);
    }, intervalMs);

    logger.info(`KeepAliveJob: Scheduled (every ${Math.round(intervalMs / 60000)} minutes) -> ${url}`);
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
  if (anomalyScanInterval) {
    clearInterval(anomalyScanInterval);
    anomalyScanInterval = null;
  }
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
  logger.info("Background jobs stopped");
}
