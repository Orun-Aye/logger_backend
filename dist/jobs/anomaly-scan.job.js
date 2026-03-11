"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAnomalyScanJob = runAnomalyScanJob;
const anomaly_service_1 = require("../services/anomaly.service");
const project_model_1 = require("../models/project.model");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Run anomaly scan across all active projects.
 * Also auto-resolves stale anomalies.
 */
async function runAnomalyScanJob() {
    const jobStart = Date.now();
    logger_1.default.info("AnomalyScanJob: Starting scan...");
    try {
        // Get all active projects
        const projects = await project_model_1.ProjectModel.find({ isActive: true }, { _id: 1 }).lean();
        let totalDetected = 0;
        let totalResolved = 0;
        for (const project of projects) {
            const projectId = project._id.toString();
            try {
                const detected = await anomaly_service_1.AnomalyService.scanProject(projectId);
                totalDetected += detected;
                const resolved = await anomaly_service_1.AnomalyService.autoResolveNormalized(projectId);
                totalResolved += resolved;
            }
            catch (error) {
                logger_1.default.error(`AnomalyScanJob: Failed for project ${projectId}`, { error });
            }
        }
        const duration = Date.now() - jobStart;
        logger_1.default.info(`AnomalyScanJob: Completed in ${duration}ms — ${projects.length} projects scanned, ${totalDetected} anomalies detected, ${totalResolved} auto-resolved`);
    }
    catch (error) {
        logger_1.default.error("AnomalyScanJob: Fatal error", { error });
    }
}
