// src/controllers/retention.controller.ts

import { Request, Response } from "express";
import { RetentionService } from "../services/retention.service";

interface ApiResponse<T = any> {
  status: "success" | "error";
  message?: string;
  data?: T;
  meta?: any;
}

export class RetentionController {
  /**
   * Preview the impact of applying a retention policy for a project.
   */
  static async previewRetention(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { retentionDays } = req.query;

      if (!retentionDays || isNaN(Number(retentionDays))) {
        return res.status(400).json({
          status: "error",
          message: "retentionDays query parameter is required and must be a number",
        } as ApiResponse);
      }

      const preview = await RetentionService.previewRetentionImpact(
        projectId,
        Number(retentionDays)
      );

      return res.status(200).json({
        status: "success",
        message: "Retention impact preview generated successfully",
        data: preview,
      } as ApiResponse);
    } catch (error) {
      console.error("RetentionController: Preview failed:", error);
      return res.status(500).json({
        status: "error",
        message: error instanceof Error ? error.message : "Failed to preview retention impact",
      } as ApiResponse);
    }
  }

  /**
   * Apply retention policy for a specific project.
   */
  static async applyRetention(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { retentionDays, samplingRate } = req.body;

      if (!retentionDays || isNaN(Number(retentionDays))) {
        return res.status(400).json({
          status: "error",
          message: "retentionDays is required and must be a number",
        } as ApiResponse);
      }

      const policy = {
        retentionDays: Number(retentionDays),
        samplingRate: samplingRate ? Number(samplingRate) : undefined,
      };

      const result = samplingRate
        ? await RetentionService.applyRetentionWithSampling(projectId, policy)
        : await RetentionService.applyRetentionPolicy(projectId, policy);

      return res.status(200).json({
        status: "success",
        message: `Retention policy applied: ${result.deletedCount} logs deleted${
          result.sampledCount ? `, ${result.sampledCount} logs sampled` : ""
        }`,
        data: result,
      } as ApiResponse);
    } catch (error) {
      console.error("RetentionController: Apply retention failed:", error);
      return res.status(500).json({
        status: "error",
        message: error instanceof Error ? error.message : "Failed to apply retention policy",
      } as ApiResponse);
    }
  }

  /**
   * Apply sampling to logs for a specific project.
   */
  static async applySampling(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { samplingRate, startDate, endDate } = req.body;

      if (!samplingRate || isNaN(Number(samplingRate))) {
        return res.status(400).json({
          status: "error",
          message: "samplingRate is required and must be a number between 0 and 100",
        } as ApiResponse);
      }

      const result = await RetentionService.applySampling(
        projectId,
        Number(samplingRate),
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined
      );

      return res.status(200).json({
        status: "success",
        message: `Sampling applied: ${result.deletedCount} logs deleted, ${result.sampledCount} logs kept`,
        data: result,
      } as ApiResponse);
    } catch (error) {
      console.error("RetentionController: Apply sampling failed:", error);
      return res.status(500).json({
        status: "error",
        message: error instanceof Error ? error.message : "Failed to apply sampling",
      } as ApiResponse);
    }
  }

  /**
   * Run retention for all projects (admin only).
   */
  static async runAllProjectRetention(req: Request, res: Response): Promise<Response> {
    try {
      const { defaultRetentionDays } = req.body;

      const results = await RetentionService.runAllProjectRetention(
        defaultRetentionDays ? Number(defaultRetentionDays) : 30
      );

      const totalDeleted = results.reduce((sum, r) => sum + r.deletedCount, 0);

      return res.status(200).json({
        status: "success",
        message: `Processed ${results.length} projects, deleted ${totalDeleted} logs`,
        data: {
          projectsProcessed: results.length,
          totalLogsDeleted: totalDeleted,
          results: results,
        },
      } as ApiResponse);
    } catch (error) {
      console.error("RetentionController: Run all retention failed:", error);
      return res.status(500).json({
        status: "error",
        message: error instanceof Error ? error.message : "Failed to run retention for all projects",
      } as ApiResponse);
    }
  }
}
