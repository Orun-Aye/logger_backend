"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeJobs = initializeJobs;
exports.stopJobs = stopJobs;
const retention_job_1 = require("./retention.job");
const logger_1 = __importDefault(require("../utils/logger"));
let retentionInterval = null;
/**
 * Initialize all background jobs.
 * Only call this in standalone server mode (not Vercel serverless).
 */
function initializeJobs(config) {
    logger_1.default.info("Initializing background jobs...");
    if (config.retention.enabled) {
        // Parse cron schedule to interval (simplified: run daily)
        // For production, consider using node-cron package
        // Using setInterval for simplicity (runs every 24 hours)
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
        retentionInterval = setInterval(async () => {
            await (0, retention_job_1.runRetentionJob)();
        }, TWENTY_FOUR_HOURS);
        logger_1.default.info("RetentionJob: Scheduled (every 24 hours)");
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
    logger_1.default.info("Background jobs stopped");
}
