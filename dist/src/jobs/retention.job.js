"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runRetentionJob = runRetentionJob;
const retention_service_1 = require("../services/retention.service");
const project_model_1 = require("../models/project.model");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Run retention cleanup for all projects
 * Called by the job scheduler on a cron schedule
 */
async function runRetentionJob() {
    logger_1.default.info("RetentionJob: Starting daily log cleanup");
    try {
        // Fetch all active projects with their retention config
        const projects = await project_model_1.ProjectModel.find({ isActive: true })
            .select("_id name retentionConfig")
            .lean();
        let totalDeleted = 0;
        let processedCount = 0;
        let errorCount = 0;
        for (const project of projects) {
            try {
                const retentionDays = project.retentionConfig?.retentionDays || 30;
                const autoCleanup = project.retentionConfig?.autoCleanupEnabled !== false;
                if (!autoCleanup) {
                    continue;
                }
                const result = await retention_service_1.RetentionService.applyRetentionPolicy(String(project._id), { retentionDays });
                totalDeleted += result.deletedCount;
                processedCount++;
                if (result.deletedCount > 0) {
                    logger_1.default.info(`RetentionJob: Project ${project.name} — deleted ${result.deletedCount} logs`);
                }
            }
            catch (error) {
                errorCount++;
                logger_1.default.error(`RetentionJob: Failed for project ${project.name}`, {
                    error: error instanceof Error ? error.message : error,
                });
            }
        }
        logger_1.default.info(`RetentionJob: Completed. Processed ${processedCount} projects, deleted ${totalDeleted} logs, ${errorCount} errors`);
    }
    catch (error) {
        logger_1.default.error("RetentionJob: Fatal error", {
            error: error instanceof Error ? error.message : error,
        });
    }
}
