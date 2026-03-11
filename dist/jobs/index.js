"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeJobs = initializeJobs;
exports.stopJobs = stopJobs;
const retention_job_1 = require("./retention.job");
const anomaly_scan_job_1 = require("./anomaly-scan.job");
const logger_1 = __importDefault(require("../utils/logger"));
let retentionInterval = null;
let anomalyScanInterval = null;
/**
 * Initialize all background jobs.
 * Only call this in standalone server mode (not Vercel serverless).
 */
function initializeJobs(config) {
    logger_1.default.info("Initializing background jobs...");
    if (config.retention.enabled) {
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
        retentionInterval = setInterval(async () => {
            await (0, retention_job_1.runRetentionJob)();
        }, TWENTY_FOUR_HOURS);
        logger_1.default.info("RetentionJob: Scheduled (every 24 hours)");
    }
    if (config.features?.anomalyDetection) {
        const FIVE_MINUTES = 5 * 60 * 1000;
        anomalyScanInterval = setInterval(async () => {
            await (0, anomaly_scan_job_1.runAnomalyScanJob)();
        }, FIVE_MINUTES);
        logger_1.default.info("AnomalyScanJob: Scheduled (every 5 minutes)");
    }
    logger_1.default.info("Background jobs initialized");
}
/**
 * Stop all background jobs gracefully
 */
function stopJobs() {
    if (retentionInterval) {
        clearInterval(retentionInterval);
        retentionInterval = null;
    }
    if (anomalyScanInterval) {
        clearInterval(anomalyScanInterval);
        anomalyScanInterval = null;
    }
    logger_1.default.info("Background jobs stopped");
}
