// @ts-nocheck

import { Request, Response } from "express";
import {
  ProjectService,
  ProjectNotFoundError,
  ProjectValidationError,
  ProjectOperationError,
} from "../services/project.service";
import { CreateProjectDTO, UpdateProjectDTO } from "../dtos/project.dto";
import { Types } from "mongoose";

/**
 * Response interface for consistent API responses
 */
interface ApiResponse<T = any> {
  status: "success" | "error";
  message?: string;
  data?: T;
  errors?: string[];
  meta?: any;
  // Additional properties for analytics endpoints
  recentProjects?: any[];
  topProjectsByLogs?: any[];
  popularTags?: any[];
  creationTrends?: any[];
}

/**
 * ProjectController - Handles all project-related HTTP requests
 * 
 * This controller provides comprehensive project management including:
 * - CRUD operations
 * - Team member management
 * - API key management
 * - Analytics and reporting
 * - Performance monitoring
 * - Bulk operations
 * - Project lifecycle management
 */
export class ProjectController {
  /**
   * Centralized error handler for consistent error responses
   * Maps service-level errors to appropriate HTTP status codes
   * 
   * @param error - The error object to handle
   * @param res - Express response object
   * @param defaultMessage - Fallback error message
   * @returns HTTP response with appropriate status and error details
   */
  private static handleError(
    error: Error,
    res: Response,
    defaultMessage: string
  ): Response {
    console.error(`ProjectController Error: ${error.message}`, error.stack);

    // Handle custom project errors
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

    // Handle database-specific errors
    if (error.name === "ValidationError") {
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

    // Generic server error fallback
    return res.status(500).json({
      status: "error",
      message: defaultMessage,
    } as ApiResponse);
  }

  /**
   * Validates and normalizes pagination and filtering parameters
   * Ensures safe limits and default values for query operations
   * 
   * @param req - Express request object containing query parameters
   * @returns Validated pagination and filter options
   */
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
    ); // Cap at 100 for performance
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

  // =============================================================================
  // CORE CRUD OPERATIONS
  // =============================================================================

  /**
   * Creates a new project
   * POST /api/projects
   * 
   * @param req - Request containing project data and authenticated user ID
   * @param res - Response with created project details
   */
  static async create(req: Request, res: Response): Promise<Response> {
    try {
      const projectData = req.body;
      // Assuming req.userId is set by authentication middleware
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

  /**
   * Retrieves all projects with pagination and filtering
   * GET /api/projects
   * 
   * Query parameters:
   * - page: Page number (default: 1)
   * - limit: Items per page (default: 10, max: 100)
   * - sortBy: Field to sort by (default: createdAt)
   * - sortOrder: asc or desc (default: desc)
   * - includeInactive: Include inactive projects (default: false)
   * - tags: Comma-separated list of tags to filter by
   */
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

  /**
   * Retrieves projects associated with a specific user
   * GET /api/projects/user
   * 
   * @param req - Request with user ID attached
   * @param res - Response with user's projects
   */
  static async getByUser(req: Request, res: Response): Promise<Response> {
    try {
      const id = req.userId;
      const { sortOrder, searchBy, includeInactive } =
        ProjectController.validatePaginationParams(req);

      const result = await ProjectService.getProjectsByUser(id, {
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
          route: "getByUser"
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

  /**
   * Retrieves a single project by ID
   * GET /api/projects/:id
   * 
   * Query parameters:
   * - populateRefs: Whether to populate referenced fields (default: false)
   */
  static async getById(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const populateRefs = req.query.populateRefs === "true";
      const includeAnalytics = req.query.includeAnalytics === "true";
      const timeRange = parseInt(req.query.timeRange as string) || 168;
      const includeRecommendations = req.query.includeRecommendations === "true";

      const options = {
        populateRefs,
        includeAnalytics,
        timeRange,
        includeRecommendations,
      };

      const project = await ProjectService.getProjectById(id, options);

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

  /**
   * Updates an existing project
   * PUT /api/projects/:id
   * 
   * @param req - Request with project ID and update data
   * @param res - Response with updated project details
   */
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

  /**
   * Deletes a project (soft delete by default)
   * DELETE /api/projects/:id
   * 
   * Query parameters:
   * - hardDelete: Whether to permanently delete (default: false)
   */
  static async delete(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const hardDelete = req.query.hardDelete === "true";

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

  // =============================================================================
  // API KEY MANAGEMENT
  // =============================================================================

  /**
   * Regenerates API key for a project
   * POST /api/projects/:id/regenerate-api-key
   * 
   * @param req - Request with project ID
   * @param res - Response with new API key details
   */
  static async regenerateApiKey(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const { id } = req.params;
      const result = await ProjectService.regenerateApiKey(id);

      return res.status(200).json({
        status: "success",
        message: "API key regenerated successfully",
        data: result,
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to regenerate API key"
      );
    }
  }

  /**
   * Finds a project by its API key
   * GET /api/projects/by-api-key
   * 
   * API key can be provided via:
   * - x-api-key header
   * - apiKey query parameter
   */
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

  // =============================================================================
  // PROJECT STATISTICS AND HEALTH MONITORING
  // =============================================================================

  /**
   * Retrieves comprehensive project statistics
   * GET /api/projects/:id/stats
   * 
   * Query parameters:
   * - recalculate: Force recalculation of stats (default: false)
   */
  static async getProjectStats(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const recalculate = req.query.recalculate === "true";
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

  /**
   * Performs health check on the project service
   * GET /api/projects/health
   * 
   * Returns service health status and metrics
   */
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
          data: healthStatus.metrics,
          meta: { checkedAt: healthStatus.checkedAt },
        } as ApiResponse);
      }
    } catch (error) {
      return res.status(500).json({
        status: "error",
        message: "Failed to perform health check due to an unexpected error",
        errors: [(error as Error).message],
      } as ApiResponse);
    }
  }

  /**
   * Gets detailed project health data including uptime, error rates, and alerts
   * GET /api/projects/:id/health
   * 
   * Query parameters:
   * - timeRange: Time range in hours (default: 24)
   * - includeAlerts: Include alert conditions (default: true)
   */
  static async getProjectHealth(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const timeRange = parseInt(req.query.timeRange as string) || 24;
      const includeAlerts = req.query.includeAlerts !== "false";

      const healthData = await ProjectService.getProjectHealth(id, {
        timeRange,
        includeAlerts,
      });

      return res.status(200).json({
        status: "success",
        message: "Project health data fetched successfully",
        data: healthData,
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to fetch project health data"
      );
    }
  }

  // =============================================================================
  // TEAM MEMBER MANAGEMENT
  // =============================================================================

  /**
   * Adds a team member to a project
   * POST /api/projects/:projectId/team-members
   * 
   * Body: { userId: string, role: "admin" | "viewer" }
   */
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

  /**
   * Removes a team member from a project
   * DELETE /api/projects/:projectId/team-members
   * 
   * Body: { userId: string }
   */
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

  /**
   * Updates a team member's role
   * PUT /api/projects/:projectId/team-members
   * 
   * Body: { userId: string, role: "admin" | "viewer" }
   */
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

  /**
   * Retrieves all team members for a project
   * GET /api/projects/:projectId/team-members
   */
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

  // =============================================================================
  // TAG MANAGEMENT
  // =============================================================================

  /**
   * Adds tags to a project
   * POST /api/projects/:projectId/tags
   * 
   * Body: { tags: string[] }
   */
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

  /**
   * Removes tags from a project
   * DELETE /api/projects/:projectId/tags
   * 
   * Body: { tags: string[] }
   */
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

  // =============================================================================
  // RATE LIMIT CONFIGURATION
  // =============================================================================

  /**
   * Updates rate limit configuration for a project
   * PUT /api/projects/:projectId/rate-limit
   * 
   * Body: { maxRequestsPerMinute?: number, burstLimit?: number }
   */
  static async updateRateLimit(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { maxRequestsPerMinute, burstLimit } = req.body;

      if (maxRequestsPerMinute === undefined && burstLimit === undefined) {
        return res.status(400).json({
          status: "error",
          message:
            "At least one of maxRequestsPerMinute or burstLimit is required",
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

  // =============================================================================
  // PROJECT LOG COUNT SYNCHRONIZATION
  // =============================================================================

  /**
   * Synchronizes log count for a specific project
   * POST /api/projects/:projectId/sync-log-count
   */
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

  /**
   * Synchronizes log counts for all projects
   * POST /api/projects/sync-all-log-counts
   * 
   * This operation may take time for large numbers of projects
   */
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

  /**
   * Increments the log count for a project
   * POST /api/projects/:projectId/increment-log-count
   * 
   * Body: { increment: number }
   */
  static async incrementLogCount(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { increment } = req.body;

      if (typeof increment !== "number" || increment <= 0) {
        return res.status(400).json({
          status: "error",
          message: "Increment must be a positive number",
        } as ApiResponse);
      }

      const result = await ProjectService.incrementLogCount(
        projectId,
        increment
      );

      return res.status(200).json({
        status: "success",
        message: "Log count incremented successfully",
        data: result,
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to increment log count"
      );
    }
  }

  // =============================================================================
  // BULK OPERATIONS
  // =============================================================================

  /**
   * Bulk delete multiple projects
   * DELETE /api/projects/bulk
   * 
   * Body: { ids: string[] }
   * Query: hardDelete=true/false
   */
  static async bulkDelete(req: Request, res: Response): Promise<Response> {
    try {
      const { ids } = req.body;
      const hardDelete = req.query.hardDelete === "true";

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

  /**
   * Bulk update multiple projects
   * PUT /api/projects/bulk
   * 
   * Body: { ids: string[], updateData: Partial<UpdateProjectDTO> }
   */
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

  // =============================================================================
  // PROJECT LIFECYCLE MANAGEMENT
  // =============================================================================

  /**
   * Restores a soft-deleted project
   * POST /api/projects/:id/restore
   */
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

  /**
   * Archives a project with optional reason
   * POST /api/projects/:id/archive
   * 
   * Body: { archiveReason?: string }
   */
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

  /**
   * Duplicates an existing project
   * POST /api/projects/:sourceProjectId/duplicate
   * 
   * Body: { newName: string, ownerId: string, options?: DuplicationOptions }
   */
  static async duplicateProject(req: Request, res: Response): Promise<Response> {
    try {
      const { sourceProjectId } = req.params;
      const { newName, ownerId, options } = req.body;

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

  /**
   * Transfers project ownership
   * POST /api/projects/:projectId/transfer-ownership
   * 
   * Body: { newOwnerId: string, currentOwnerId: string }
   */
  static async transferOwnership(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { newOwnerId, currentOwnerId } = req.body;

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

  // =============================================================================
  // INTEGRATION SETTINGS MANAGEMENT
  // =============================================================================

  /**
   * Updates integration settings for a project
   * PUT /api/projects/:projectId/integration-settings
   * 
   * Body: { integrationSettings: Record<string, any> }
   */
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

  // =============================================================================
  // ANALYTICS AND REPORTING
  // =============================================================================

  /**
   * Gets comprehensive project analytics
   * GET /api/projects/analytics
   * 
   * Query parameters:
   * - startDate: Start date for analytics (ISO string)
   * - endDate: End date for analytics (ISO string)
   * - groupBy: Grouping granularity (day/week/month)
   */
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

  /**
   * Gets comprehensive projects summary with enhanced metadata
   * GET /api/projects/summary
   * 
   * Query parameters:
   * - groupBy: Grouping for trends (day/week/month)
   * - startDate: Start date for filtering
   * - endDate: End date for filtering
   * - includeInactive: Include inactive projects
   * - limit: Limit for top lists (default: 5)
   */
  static async getProjectsSummary(req: Request, res: Response): Promise<Response> {
    try {
      const { groupBy, startDate, endDate, includeInactive, limit } = req.query;
      const userId = req.userId; // From authentication middleware

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

  // =============================================================================
  // PERFORMANCE MONITORING AND METRICS
  // =============================================================================

  /**
   * Gets log volume trends over time
   * GET /api/projects/metrics/log-volume
   * 
   * Query parameters:
   * - projectId: Specific project ID (optional)
   * - startDate: Start date for analysis
   * - endDate: End date for analysis
   * - granularity: Time granularity (hour/day/week/month)
   */
  static async getLogVolumeTrends(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId, startDate, endDate, granularity } = req.query;
      const userId = req.userId;

      const options = {
        projectId: projectId as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        granularity: granularity as "hour" | "day" | "week" | "month",
        userId,
      };

      const trends = await ProjectService.getLogVolumeTrends(options);

      return res.status(200).json({
        status: "success",
        message: "Log volume trends fetched successfully",
        data: trends,
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to fetch log volume trends"
      );
    }
  }

  /**
   * Gets comprehensive error distribution analysis
   * GET /api/projects/metrics/error-distribution
   * 
   * Query parameters:
   * - projectId: Specific project ID (optional)
   * - startDate: Start date for analysis
   * - endDate: End date for analysis
   * - limit: Limit for top lists (default: 10)
   */
  static async getErrorDistribution(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId, startDate, endDate, limit } = req.query;
      const userId = req.userId;

      const options = {
        projectId: projectId as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        userId,
        limit: limit ? parseInt(limit as string) : undefined,
      };

      const distribution = await ProjectService.getErrorDistribution(options);

      return res.status(200).json({
        status: "success",
        message: "Error distribution fetched successfully",
        data: distribution,
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to fetch error distribution"
      );
    }
  }

  /**
   * Gets log levels distribution with timeline
   * GET /api/projects/metrics/log-levels
   * 
   * Query parameters:
   * - projectId: Specific project ID (optional)
   * - startDate: Start date for analysis
   * - endDate: End date for analysis
   */
  static async getLogLevelsDistribution(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId, startDate, endDate } = req.query;
      const userId = req.userId;

      const options = {
        projectId: projectId as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        userId,
      };

      const distribution = await ProjectService.getLogLevelsDistribution(options);

      return res.status(200).json({
        status: "success",
        message: "Log levels distribution fetched successfully",
        data: distribution,
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to fetch log levels distribution"
      );
    }
  }

  /**
   * Gets response time trends and performance metrics
   * GET /api/projects/metrics/response-times
   * 
   * Query parameters:
   * - projectId: Specific project ID (optional)
   * - startDate: Start date for analysis
   * - endDate: End date for analysis
   * - granularity: Time granularity (hour/day)
   */
  static async getResponseTimeTrends(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId, startDate, endDate, granularity } = req.query;
      const userId = req.userId;

      const options = {
        projectId: projectId as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        granularity: granularity as "hour" | "day",
        userId,
      };

      const trends = await ProjectService.getResponseTimeTrends(options);

      return res.status(200).json({
        status: "success",
        message: "Response time trends fetched successfully",
        data: trends,
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to fetch response time trends"
      );
    }
  }

  /**
   * Gets top error sources with detailed analysis
   * GET /api/projects/metrics/error-sources
   * 
   * Query parameters:
   * - projectId: Specific project ID (optional)
   * - startDate: Start date for analysis
   * - endDate: End date for analysis
   * - limit: Number of sources to return (default: 10)
   * - groupBy: Group errors by field (url/service/userAgent/error.name)
   */
  static async getTopErrorSources(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId, startDate, endDate, limit, groupBy } = req.query;
      const userId = req.userId;

      const options = {
        projectId: projectId as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        userId,
        limit: limit ? parseInt(limit as string) : undefined,
        groupBy: groupBy as "url" | "service" | "userAgent" | "error.name",
      };

      const sources = await ProjectService.getTopErrorSources(options);

      return res.status(200).json({
        status: "success",
        message: "Top error sources fetched successfully",
        data: sources,
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to fetch top error sources"
      );
    }
  }

  /**
   * Gets comprehensive service performance metrics
   * GET /api/projects/metrics/service-performance
   * 
   * Query parameters:
   * - projectId: Specific project ID (optional)
   * - serviceName: Specific service name (optional)
   * - startDate: Start date for analysis
   * - endDate: End date for analysis
   */
  static async getServicePerformance(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId, serviceName, startDate, endDate } = req.query;
      const userId = req.userId;

      const options = {
        projectId: projectId as string,
        serviceName: serviceName as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        userId,
      };

      const performance = await ProjectService.getServicePerformance(options);

      return res.status(200).json({
        status: "success",
        message: "Service performance metrics fetched successfully",
        data: performance,
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to fetch service performance metrics"
      );
    }
  }

  /**
   * Gets comprehensive usage statistics
   * GET /api/projects/metrics/usage-statistics
   * 
   * Query parameters:
   * - startDate: Start date for analysis
   * - endDate: End date for analysis
   * - includeUserBreakdown: Include user-level breakdown (default: false)
   */
  static async getUsageStatistics(req: Request, res: Response): Promise<Response> {
    try {
      const { startDate, endDate, includeUserBreakdown } = req.query;
      const userId = req.userId;

      const options = {
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        userId,
        includeUserBreakdown: includeUserBreakdown === "true",
      };

      const statistics = await ProjectService.getUsageStatistics(options);

      return res.status(200).json({
        status: "success",
        message: "Usage statistics fetched successfully",
        data: statistics,
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to fetch usage statistics"
      );
    }
  }

  // =============================================================================
  // SEARCH AND FILTERING
  // =============================================================================

  /**
   * Searches projects by name or description
   * GET /api/projects/search
   * 
   * Query parameters:
   * - q: Search query string
   * - limit: Maximum results to return (default: 10)
   * - includeInactive: Include inactive projects (default: false)
   * - tags: Comma-separated tags to filter by
   */
  static async searchProjects(req: Request, res: Response): Promise<Response> {
    try {
      const { q: query, limit, includeInactive, tags } = req.query;
      const userId = req.userId;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({
          status: "error",
          message: "Search query 'q' parameter is required",
        } as ApiResponse);
      }

      const options = {
        limit: limit ? parseInt(limit as string) : undefined,
        includeInactive: includeInactive === "true",
        tags: typeof tags === "string" ? tags.split(",").map(tag => tag.trim()) : undefined,
        userId,
      };

      const results = await ProjectService.searchProjects(query, options);

      return res.status(200).json({
        status: "success",
        message: "Project search completed successfully",
        data: results,
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to search projects"
      );
    }
  }

  // =============================================================================
  // DATA EXPORT AND IMPORT
  // =============================================================================

  /**
   * Exports project data with optional log inclusion
   * GET /api/projects/:projectId/export
   * 
   * Query parameters:
   * - includeLogs: Include log data in export (default: false)
   * - startDate: Start date for log export (if includeLogs=true)
   * - endDate: End date for log export (if includeLogs=true)
   * - format: Export format (json/csv) (default: json)
   */
  static async exportProjectData(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { includeLogs, startDate, endDate, format } = req.query;

      const options = {
        includeLogs: includeLogs === "true",
        dateRange: (startDate && endDate) ? {
          start: new Date(startDate as string),
          end: new Date(endDate as string),
        } : undefined,
        format: format as "json" | "csv" || "json",
      };

      const exportData = await ProjectService.exportProjectData(projectId, options);

      // Set appropriate headers for file download
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `project-${projectId}-export-${timestamp}.${options.format}`;
      
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 
        options.format === 'csv' ? 'text/csv' : 'application/json'
      );

      return res.status(200).json({
        status: "success",
        message: "Project data exported successfully",
        data: exportData,
        meta: {
          filename,
          exportedAt: new Date(),
          format: options.format,
        },
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to export project data"
      );
    }
  }
}