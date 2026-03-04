import { RetentionService } from "../services/retention.service";
import { ProjectModel } from "../models/project.model";
import logger from "../utils/logger";

/**
 * Run retention cleanup for all projects
 * Called by the job scheduler on a cron schedule
 */
export async function runRetentionJob(): Promise<void> {
  logger.info("RetentionJob: Starting daily log cleanup");

  try {
    // Fetch all active projects with their retention config
    const projects = await ProjectModel.find({ isActive: true })
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

        const result = await RetentionService.applyRetentionPolicy(
          String(project._id),
          { retentionDays }
        );

        totalDeleted += result.deletedCount;
        processedCount++;

        if (result.deletedCount > 0) {
          logger.info(`RetentionJob: Project ${project.name} — deleted ${result.deletedCount} logs`);
        }
      } catch (error) {
        errorCount++;
        logger.error(`RetentionJob: Failed for project ${project.name}`, {
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    logger.info(
      `RetentionJob: Completed. Processed ${processedCount} projects, deleted ${totalDeleted} logs, ${errorCount} errors`
    );
  } catch (error) {
    logger.error("RetentionJob: Fatal error", {
      error: error instanceof Error ? error.message : error,
    });
  }
}
