// @ts-nocheck

import { Request, Response } from "express";
import {
  ProjectService,
  ProjectNotFoundError,
  ProjectValidationError,
  ProjectOperationError, // Import new error class
} from "../services/project.service";
import { CreateProjectDTO, UpdateProjectDTO } from "../dtos/project.dto";
import { Types } from "mongoose"; // Import Types for ObjectId validation if needed in controller

// Response interface for consistency
interface ApiResponse<T = any> {
  status: "success" | "error";
  message?: string;
  data?: T;
  errors?: string[];
  meta?: any;
}

export class ProjectController {
  // Centralized error handler
  private static handleError(
    error: Error,
    res: Response,
    defaultMessage: string
  ): Response {
    console.error(`ProjectController Error: ${error.message}`, error.stack);

    if (error instanceof ProjectValidationError) {
      return res.status(400).json({
        status: "error",
        message: error.message,
        errors: [error.message],
      } as ApiResponse);
    }

    if (error instanceof ProjectNotFoundError) {
      return res.status(404).json({
        status: "error",
        message: error.message,
      } as ApiResponse);
    }

    if (error instanceof ProjectOperationError) {
      return res.status(500).json({
        status: "error",
        message: error.message,
      } as ApiResponse);
    }

    // Database/MongoDB specific errors
    if (error.name === "ValidationError") {
      // Mongoose validation error
      const errors = Object.values((error as any).errors).map(
        (err: any) => err.message
      );
      return res.status(400).json({
        status: "error",
        message: "Validation failed",
        errors: errors,
      } as ApiResponse);
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        status: "error",
        message: "Invalid ID format or value",
      } as ApiResponse);
    }

    // Generic server error
    return res.status(500).json({
      status: "error",
      message: defaultMessage,
    } as ApiResponse);
  }

  // Input validation helper for pagination
  private static validatePaginationParams(req: Request): {
    page: number;
    limit: number;
    sortBy: string;
    sortOrder: "asc" | "desc";
    includeInactive?: boolean;
    tags?: string[];
    searchBy?: "owner" | "teamMember" | "both";
  } {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit as string) || 10)
    ); // Cap at 100
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";
    const includeInactive = req.query.includeInactive === "true";
    const tags =
      typeof req.query.tags === "string"
        ? req.query.tags.split(",").map((tag) => tag.trim())
        : undefined;
    const searchBy = req.query.searchBy as
      | "owner"
      | "teamMember"
      | "both"
      | undefined;

    return { page, limit, sortBy, sortOrder, includeInactive, tags, searchBy };
  }

  // --- Core CRUD Operations ---

  static async create(req: Request, res: Response): Promise<Response> {
    try {
      const projectData = req.body;
      // Assuming req.userId is set by an authentication middleware
      const payload: CreateProjectDTO = { ...projectData, ownerId: req.userId };
      const project = await ProjectService.createProject(payload);

      return res.status(201).json({
        status: "success",
        message: "Project created successfully",
        data: project,
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to create project"
      );
    }
  }

  static async getAll(req: Request, res: Response): Promise<Response> {
    try {
      const { page, limit, sortBy, sortOrder, includeInactive, tags } =
        ProjectController.validatePaginationParams(req);
      const result = await ProjectService.getAllProjects({
        page,
        limit,
        sortBy,
        sortOrder,
        includeInactive,
        tags,
      });

      return res.status(200).json({
        status: "success",
        message: "Projects fetched successfully",
        data: result.projects,
        meta: {
          pagination: result.pagination,
        },
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to fetch projects"
      );
    }
  }

  static async getByUser(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { page, limit, sortBy, sortOrder, searchBy, includeInactive } =
        ProjectController.validatePaginationParams(req); // Reuse pagination validation

      const result = await ProjectService.getProjectsByUser(id, {
        page,
        limit,
        sortBy,
        sortOrder,
        searchBy,
        includeInactive,
      });

      return res.status(200).json({
        status: "success",
        message: "Projects by user fetched successfully",
        data: result.projects,
        meta: {
          pagination: result.pagination,
        },
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to fetch projects by user"
      );
    }
  }

  static async getById(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const populateRefs = req.query.populateRefs === "true"; // New query param
      const project = await ProjectService.getProjectById(id, populateRefs);

      return res.status(200).json({
        status: "success",
        message: "Project fetched successfully",
        data: project,
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to fetch project"
      );
    }
  }

  static async updateById(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const updateData: UpdateProjectDTO = req.body;

      const updatedProject = await ProjectService.updateProject(id, updateData);

      return res.status(200).json({
        status: "success",
        message: "Project updated successfully",
        data: updatedProject,
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to update project"
      );
    }
  }

  static async delete(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const hardDelete = req.query.hardDelete === "true"; // New query param for hard delete

      await ProjectService.deleteProject(id, !hardDelete); // !hardDelete means softDelete

      return res.status(204).send(); // 204 No Content for successful deletion
    } catch (error) {
      // For delete operations that fail, return error response instead of 204
      if (error instanceof ProjectNotFoundError) {
        return res.status(404).json({
          status: "error",
          message: error.message,
        } as ApiResponse);
      }
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to delete project"
      );
    }
  }

  // --- API Key Management ---

  static async regenerateApiKey(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const { id } = req.params;
      const result = await ProjectService.regenerateApiKey(id); // Result now contains more info

      return res.status(200).json({
        status: "success",
        message: "API key regenerated successfully",
        data: result, // Pass the whole result object
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to regenerate API key"
      );
    }
  }

  static async getProjectByApiKey(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const apiKey =
        (req.headers["x-api-key"] as string) || (req.query.apiKey as string);

      if (!apiKey) {
        return res.status(400).json({
          status: "error",
          message:
            "API key is required (provide via x-api-key header or apiKey query parameter)",
        } as ApiResponse);
      }

      const project = await ProjectService.getProjectByApiKey(apiKey);

      return res.status(200).json({
        status: "success",
        message: "Project found",
        data: project,
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to find project"
      );
    }
  }

  // --- Project Statistics and Health ---

  static async getProjectStats(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const recalculate = req.query.recalculate === "true"; // New query param
      const stats = await ProjectService.getProjectStats(id, recalculate);

      return res.status(200).json({
        status: "success",
        message: "Project stats fetched successfully",
        data: stats,
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to fetch project stats"
      );
    }
  }

  static async healthCheck(req: Request, res: Response): Promise<Response> {
    try {
      const healthStatus = await ProjectService.healthCheck();

      if (healthStatus.status === "healthy") {
        return res.status(200).json({
          status: "success",
          message: "Project service is healthy",
          data: healthStatus.metrics,
          meta: { checkedAt: healthStatus.checkedAt },
        } as ApiResponse);
      } else {
        return res.status(503).json({
          status: "error",
          message: "Project service is unhealthy",
          errors: [healthStatus.error],
          data: healthStatus.metrics, // Still return available metrics
          meta: { checkedAt: healthStatus.checkedAt },
        } as ApiResponse);
      }
    } catch (error) {
      // This catch block would handle errors from ProjectService.healthCheck itself failing to execute
      return res.status(500).json({
        status: "error",
        message: "Failed to perform health check due to an unexpected error",
        errors: [(error as Error).message],
      } as ApiResponse);
    }
  }

  // --- Team Member Management ---

  static async addTeamMember(req: Request, res: Response) {
    try {
      const { userId, role } = req.body;
      const projectId = req.params.projectId;

      if (!userId || !role) {
        return res.status(400).json({
          status: "error",
          message: "userId and role are required",
        } as ApiResponse);
      }

      const updatedProject = await ProjectService.addTeamMember(
        projectId,
        userId,
        role
      );

      return res.status(200).json({
        status: "success",
        message: "Team member added successfully",
        data: updatedProject,
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to add team member"
      );
    }
  }

  static async removeTeamMember(req: Request, res: Response) {
    try {
      const { userId } = req.body;
      const projectId = req.params.projectId;

      if (!userId) {
        return res.status(400).json({
          status: "error",
          message: "userId is required",
        } as ApiResponse);
      }

      const result = await ProjectService.removeTeamMember(projectId, userId);

      return res.status(200).json({
        status: "success",
        message: "Team member removed successfully",
        data: result,
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to remove team member"
      );
    }
  }

  static async updateTeamMemberRole(req: Request, res: Response) {
    try {
      const { userId, role } = req.body;
      const projectId = req.params.projectId;

      if (!userId || !role) {
        return res.status(400).json({
          status: "error",
          message: "userId and role are required",
        } as ApiResponse);
      }

      const updatedProject = await ProjectService.updateTeamMemberRole(
        projectId,
        userId,
        role
      );

      return res.status(200).json({
        status: "success",
        message: "Team member role updated successfully",
        data: updatedProject,
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to update team member role"
      );
    }
  }

  static async getTeamMembers(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const teamMembers = await ProjectService.getTeamMembers(projectId);

      return res.status(200).json({
        status: "success",
        message: "Team members fetched successfully",
        data: teamMembers,
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to get team members"
      );
    }
  }

  // --- Tag Management ---

  static async addTags(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { tags } = req.body;

      if (!Array.isArray(tags) || tags.length === 0) {
        return res.status(400).json({
          status: "error",
          message: "An array of tags is required",
        } as ApiResponse);
      }

      const result = await ProjectService.addProjectTags(projectId, tags);

      return res.status(200).json({
        status: "success",
        message: "Tags added successfully",
        data: result,
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to add tags to project"
      );
    }
  }

  static async removeTags(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { tags } = req.body;

      if (!Array.isArray(tags) || tags.length === 0) {
        return res.status(400).json({
          status: "error",
          message: "An array of tags is required",
        } as ApiResponse);
      }

      const result = await ProjectService.removeProjectTags(projectId, tags);

      return res.status(200).json({
        status: "success",
        message: "Tags removed successfully",
        data: result,
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to remove tags from project"
      );
    }
  }

  // --- Rate Limit Configuration ---

  static async updateRateLimit(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { maxRequestsPerMinute, burstLimit } = req.body;

      if (
        maxRequestsPerMinute === undefined &&
        burstLimit === undefined
      ) {
        return res.status(400).json({
          status: "error",
          message: "At least one of maxRequestsPerMinute or burstLimit is required",
        } as ApiResponse);
      }

      const result = await ProjectService.updateRateLimitConfig(projectId, {
        maxRequestsPerMinute,
        burstLimit,
      });

      return res.status(200).json({
        status: "success",
        message: "Rate limit configuration updated successfully",
        data: result,
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to update rate limit configuration"
      );
    }
  }

  // --- Project Log Count Sync ---

  static async syncLogCount(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const result = await ProjectService.syncLogCount(projectId);

      return res.status(200).json({
        status: "success",
        message: "Project log count synced successfully",
        data: result,
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to sync project log count"
      );
    }
  }

  static async syncAllLogCounts(req: Request, res: Response): Promise<Response> {
    try {
      const result = await ProjectService.syncAllProjectLogCounts();

      return res.status(200).json({
        status: "success",
        message: "All project log counts synced successfully",
        data: result,
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to sync all project log counts"
      );
    }
  }

  static async incrementLogCount(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { increment } = req.body;

      if (typeof increment !== 'number' || increment <= 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Increment must be a positive number',
        } as ApiResponse);
      }

      const result = await ProjectService.incrementLogCount(projectId, increment);

      return res.status(200).json({
        status: 'success',
        message: 'Log count incremented successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        'Failed to increment log count'
      );
    }
  }


  // --- Bulk Operations ---

  static async bulkDelete(req: Request, res: Response): Promise<Response> {
    try {
      const { ids } = req.body;
      const hardDelete = req.query.hardDelete === "true"; // Allow hard delete for bulk

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          status: "error",
          message: "Array of project IDs is required",
        } as ApiResponse);
      }

      if (ids.length > 50) {
        return res.status(400).json({
          status: "error",
          message: "Cannot delete more than 50 projects at once",
        } as ApiResponse);
      }

      const results = {
        deleted: [] as string[],
        failed: [] as { id: string; error: string }[],
      };

      // Process deletions with error handling for each
      for (const id of ids) {
        try {
          await ProjectService.deleteProject(id, !hardDelete);
          results.deleted.push(id);
        } catch (error) {
          results.failed.push({
            id,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      return res.status(200).json({
        status: "success",
        message: `Bulk delete completed. ${results.deleted.length} deleted, ${results.failed.length} failed`,
        data: results,
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to perform bulk delete"
      );
    }
  }

  static async bulkUpdate(req: Request, res: Response): Promise<Response> {
    try {
      const { ids, updateData } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          status: "error",
          message: "Array of project IDs is required",
        } as ApiResponse);
      }

      if (!updateData || Object.keys(updateData).length === 0) {
        return res.status(400).json({
          status: "error",
          message: "Update data is required",
        } as ApiResponse);
      }

      const result = await ProjectService.bulkUpdateProjects(ids, updateData);

      return res.status(200).json({
        status: "success",
        message: "Bulk update completed successfully",
        data: result,
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to perform bulk update"
      );
    }
  }

  // --- Project Lifecycle Management ---

  static async restoreProject(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const result = await ProjectService.restoreProject(id);

      return res.status(200).json({
        status: "success",
        message: "Project restored successfully",
        data: result,
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to restore project"
      );
    }
  }

  static async archiveProject(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { archiveReason } = req.body;

      const result = await ProjectService.archiveProject(id, archiveReason);

      return res.status(200).json({
        status: "success",
        message: "Project archived successfully",
        data: result,
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to archive project"
      );
    }
  }

  static async duplicateProject(req: Request, res: Response): Promise<Response> {
    try {
      const { sourceProjectId } = req.params;
      const { newName, ownerId, options } = req.body; // ownerId should probably come from auth context for security

      if (!newName || !ownerId) {
        return res.status(400).json({
          status: "error",
          message: "New project name and ownerId are required",
        } as ApiResponse);
      }

      const result = await ProjectService.duplicateProject(
        sourceProjectId,
        newName,
        ownerId,
        options
      );

      return res.status(201).json({
        status: "success",
        message: "Project duplicated successfully",
        data: result,
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to duplicate project"
      );
    }
  }

  static async transferOwnership(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { newOwnerId, currentOwnerId } = req.body; // currentOwnerId should ideally be from req.userId

      if (!newOwnerId || !currentOwnerId) {
        return res.status(400).json({
          status: "error",
          message: "newOwnerId and currentOwnerId are required",
        } as ApiResponse);
      }

      const result = await ProjectService.transferOwnership(
        projectId,
        newOwnerId,
        currentOwnerId
      );

      return res.status(200).json({
        status: "success",
        message: "Project ownership transferred successfully",
        data: result,
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to transfer project ownership"
      );
    }
  }

  // --- Integration Settings ---

  static async updateIntegrationSettings(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { integrationSettings } = req.body;

      if (!integrationSettings || typeof integrationSettings !== 'object') {
        return res.status(400).json({
          status: 'error',
          message: 'Integration settings object is required',
        } as ApiResponse);
      }

      const result = await ProjectService.updateIntegrationSettings(projectId, integrationSettings);

      return res.status(200).json({
        status: 'success',
        message: 'Integration settings updated successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        'Failed to update integration settings'
      );
    }
  }

  // --- Analytics and Summary ---

  static async getAnalytics(req: Request, res: Response): Promise<Response> {
    try {
      const { startDate, endDate, groupBy } = req.query;

      const options = {
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        groupBy: groupBy as "day" | "week" | "month",
      };

      const analytics = await ProjectService.getProjectsAnalytics(options);

      return res.status(200).json({
        status: "success",
        message: "Project analytics fetched successfully",
        data: analytics,
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to fetch project analytics"
      );
    }
  }

  static async getProjectsSummary(req: Request, res: Response): Promise<Response> {
    try {
      const { groupBy, startDate, endDate, includeInactive, limit } = req.query;
      const userId = req.userId; // Assuming userId from authentication

      const options = {
        groupBy: groupBy as "day" | "week" | "month" | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        includeInactive: includeInactive === "true",
        limit: limit ? parseInt(limit as string) : undefined,
      };

      const summary = await ProjectService.getProjectsSummary(userId, options);

      return res.status(200).json({
        status: "success",
        message: "Projects summary fetched successfully",
        data: summary.summary,
        meta: summary.metadata,
        recentProjects: summary.recentProjects,
        topProjectsByLogs: summary.topProjectsByLogs,
        popularTags: summary.popularTags,
        creationTrends: summary.creationTrends,
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to fetch projects summary"
      );
    }
  }
}