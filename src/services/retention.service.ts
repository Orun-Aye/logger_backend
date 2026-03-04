// src/services/retention.service.ts

import { LogModel } from "../models/log.model";
import { Types } from "mongoose";

export interface RetentionPolicy {
  retentionDays: number; // Number of days to retain logs
  samplingRate?: number; // Optional: Percentage of logs to keep after retention period (0-100)
}

export interface RetentionResult {
  projectId: string;
  deletedCount: number;
  sampledCount?: number;
  oldestTimestamp?: Date;
  executedAt: Date;
}

export class RetentionService {
  /**
   * Apply retention policy for a specific project.
   * Deletes logs older than the retention period.
   * @param projectId The ID of the project.
   * @param policy The retention policy to apply.
   * @returns A result object with deletion statistics.
   */
  static async applyRetentionPolicy(
    projectId: string,
    policy: RetentionPolicy
  ): Promise<RetentionResult> {
    try {
      if (!Types.ObjectId.isValid(projectId)) {
        throw new Error(`Invalid project ID: ${projectId}`);
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

      // Delete logs older than retention period
      const deleteResult = await LogModel.deleteMany({
        projectId: new Types.ObjectId(projectId),
        timestamp: { $lt: cutoffDate.toISOString() },
      });

      return {
        projectId,
        deletedCount: deleteResult.deletedCount || 0,
        oldestTimestamp: cutoffDate,
        executedAt: new Date(),
      };
    } catch (error) {
      console.error(
        `RetentionService: Failed to apply retention policy for project ${projectId}:`,
        error
      );
      throw new Error(
        `Failed to apply retention policy: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Apply sampling to logs for a specific project.
   * Randomly deletes logs to reduce volume while keeping a representative sample.
   * @param projectId The ID of the project.
   * @param samplingRate Percentage of logs to KEEP (0-100).
   * @param startDate Optional start date for sampling window.
   * @param endDate Optional end date for sampling window.
   * @returns A result object with sampling statistics.
   */
  static async applySampling(
    projectId: string,
    samplingRate: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<RetentionResult> {
    try {
      if (!Types.ObjectId.isValid(projectId)) {
        throw new Error(`Invalid project ID: ${projectId}`);
      }

      if (samplingRate < 0 || samplingRate > 100) {
        throw new Error("Sampling rate must be between 0 and 100");
      }

      // Build time range query
      const query: any = {
        projectId: new Types.ObjectId(projectId),
      };

      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = startDate.toISOString();
        if (endDate) query.timestamp.$lte = endDate.toISOString();
      }

      // Count total logs in range
      const totalLogs = await LogModel.countDocuments(query);

      if (totalLogs === 0) {
        return {
          projectId,
          deletedCount: 0,
          sampledCount: 0,
          executedAt: new Date(),
        };
      }

      // Calculate how many logs to keep
      const logsToKeep = Math.ceil((totalLogs * samplingRate) / 100);
      const logsToDelete = totalLogs - logsToKeep;

      if (logsToDelete <= 0) {
        return {
          projectId,
          deletedCount: 0,
          sampledCount: totalLogs,
          executedAt: new Date(),
        };
      }

      // Use MongoDB aggregation with $sample to randomly select logs to DELETE
      // This is more efficient than selecting logs to keep for large datasets
      const logsToRemove = await LogModel.aggregate([
        { $match: query },
        { $sample: { size: logsToDelete } },
        { $project: { _id: 1 } },
      ]);

      const idsToRemove = logsToRemove.map((log) => log._id);

      // Delete the sampled logs
      const deleteResult = await LogModel.deleteMany({
        _id: { $in: idsToRemove },
      });

      return {
        projectId,
        deletedCount: deleteResult.deletedCount || 0,
        sampledCount: totalLogs - (deleteResult.deletedCount || 0),
        executedAt: new Date(),
      };
    } catch (error) {
      console.error(
        `RetentionService: Failed to apply sampling for project ${projectId}:`,
        error
      );
      throw new Error(
        `Failed to apply sampling: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Apply retention policy with optional sampling.
   * First deletes old logs, then optionally samples remaining logs.
   * @param projectId The ID of the project.
   * @param policy The retention policy to apply.
   * @returns A result object with combined statistics.
   */
  static async applyRetentionWithSampling(
    projectId: string,
    policy: RetentionPolicy
  ): Promise<RetentionResult> {
    try {
      // First apply retention (delete old logs)
      const retentionResult = await this.applyRetentionPolicy(projectId, policy);

      // If sampling is configured, apply it to remaining logs
      if (policy.samplingRate && policy.samplingRate < 100) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

        const samplingResult = await this.applySampling(
          projectId,
          policy.samplingRate,
          cutoffDate // Only sample logs within retention period
        );

        return {
          projectId,
          deletedCount: retentionResult.deletedCount + samplingResult.deletedCount,
          sampledCount: samplingResult.sampledCount,
          oldestTimestamp: retentionResult.oldestTimestamp,
          executedAt: new Date(),
        };
      }

      return retentionResult;
    } catch (error) {
      console.error(
        `RetentionService: Failed to apply retention with sampling for project ${projectId}:`,
        error
      );
      throw new Error(
        `Failed to apply retention with sampling: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Run retention policies for all projects.
   * This should be called by a scheduled job (e.g., daily cron job).
   * @param defaultRetentionDays Default retention period if project doesn't have one.
   * @returns Array of retention results for all projects.
   */
  static async runAllProjectRetention(
    defaultRetentionDays: number = 30
  ): Promise<RetentionResult[]> {
    try {
      // Get all unique project IDs from logs
      const projectIds = await LogModel.distinct("projectId");

      const results: RetentionResult[] = [];

      for (const projectId of projectIds) {
        try {
          // TODO: In a production system, fetch retention policy from project settings
          // For now, use default retention policy
          const policy: RetentionPolicy = {
            retentionDays: defaultRetentionDays,
          };

          const result = await this.applyRetentionPolicy(
            projectId.toString(),
            policy
          );
          results.push(result);
        } catch (error) {
          console.error(
            `RetentionService: Failed to process project ${projectId}:`,
            error
          );
          // Continue with next project
        }
      }

      console.log(
        `RetentionService: Processed ${results.length} projects, deleted ${results.reduce(
          (sum, r) => sum + r.deletedCount,
          0
        )} logs`
      );

      return results;
    } catch (error) {
      console.error("RetentionService: Failed to run all project retention:", error);
      throw new Error(
        `Failed to run all project retention: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get statistics about logs that would be affected by a retention policy.
   * Useful for preview before applying policy.
   * @param projectId The ID of the project.
   * @param retentionDays Number of days to simulate.
   * @returns Statistics about affected logs.
   */
  static async previewRetentionImpact(
    projectId: string,
    retentionDays: number
  ): Promise<{
    totalLogs: number;
    logsToDelete: number;
    logsToKeep: number;
    oldestLogTimestamp?: Date;
    newestLogTimestamp?: Date;
  }> {
    try {
      if (!Types.ObjectId.isValid(projectId)) {
        throw new Error(`Invalid project ID: ${projectId}`);
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const [totalLogs, logsToDelete, oldestLog, newestLog] = await Promise.all([
        LogModel.countDocuments({ projectId: new Types.ObjectId(projectId) }),
        LogModel.countDocuments({
          projectId: new Types.ObjectId(projectId),
          timestamp: { $lt: cutoffDate.toISOString() },
        }),
        LogModel.findOne({ projectId: new Types.ObjectId(projectId) })
          .sort({ timestamp: 1 })
          .select("timestamp")
          .lean(),
        LogModel.findOne({ projectId: new Types.ObjectId(projectId) })
          .sort({ timestamp: -1 })
          .select("timestamp")
          .lean(),
      ]);

      return {
        totalLogs,
        logsToDelete,
        logsToKeep: totalLogs - logsToDelete,
        oldestLogTimestamp: oldestLog ? new Date(oldestLog.timestamp) : undefined,
        newestLogTimestamp: newestLog ? new Date(newestLog.timestamp) : undefined,
      };
    } catch (error) {
      console.error(
        `RetentionService: Failed to preview retention impact for project ${projectId}:`,
        error
      );
      throw new Error(
        `Failed to preview retention impact: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}
