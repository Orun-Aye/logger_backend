import { AnomalyService } from "../services/anomaly.service";
import { ProjectModel } from "../models/project.model";
import logger from "../utils/logger";

/**
 * Run anomaly scan across all active projects.
 * Also auto-resolves stale anomalies.
 */
export async function runAnomalyScanJob(): Promise<void> {
  const jobStart = Date.now();
  logger.info("AnomalyScanJob: Starting scan...");

  try {
    // Get all active projects
    const projects = await ProjectModel.find(
      { isActive: true },
      { _id: 1 }
    ).lean();

    let totalDetected = 0;
    let totalResolved = 0;

    for (const project of projects) {
      const projectId = project._id.toString();

      try {
        const detected = await AnomalyService.scanProject(projectId);
        totalDetected += detected;

        const resolved = await AnomalyService.autoResolveNormalized(projectId);
        totalResolved += resolved;
      } catch (error) {
        logger.error(`AnomalyScanJob: Failed for project ${projectId}`, { error });
      }
    }

    const duration = Date.now() - jobStart;
    logger.info(
      `AnomalyScanJob: Completed in ${duration}ms — ${projects.length} projects scanned, ${totalDetected} anomalies detected, ${totalResolved} auto-resolved`
    );
  } catch (error) {
    logger.error("AnomalyScanJob: Fatal error", { error });
  }
}
