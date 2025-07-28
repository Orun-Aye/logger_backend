// @ts-nocheck

import { Request, Response } from "express";
import {
  ProjectService,
  ProjectNotFoundError,
  ProjectValidationError,
} from "../services/project.service";
import { CreateProjectDTO, UpdateProjectDTO } from "../dtos/project.dto";

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

    // Database/MongoDB specific errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        status: "error",
        message: "Validation failed",
        errors: Object.values((error as any).errors).map(
          (err: any) => err.message
        ),
      } as ApiResponse);
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        status: "error",
        message: "Invalid ID format",
      } as ApiResponse);
    }

    // Generic server error
    return res.status(500).json({
      status: "error",
      message: defaultMessage,
    } as ApiResponse);
  }

  // Input validation helper
  private static validatePaginationParams(req: Request): {
    page: number;
    limit: number;
    sortBy: string;
    sortOrder: "asc" | "desc";
  } {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit as string) || 10)
    ); // Cap at 100
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";

    return { page, limit, sortBy, sortOrder };
  }

  static async create(req: Request, res: Response): Promise<Response> {
    try {
      const projectData = req.body;
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
        "Failed to create project1"
      );
    }
  }

  static async getAll(req: Request, res: Response): Promise<Response> {
    try {
      const paginationParams = ProjectController.validatePaginationParams(req);
      const result = await ProjectService.getAllProjects(paginationParams);

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
      const paginationParams = ProjectController.validatePaginationParams(req);
      const { id } = req.params
      const result = await ProjectService.getProjectsByUser(id, paginationParams)
    } catch (error) {
      
    }
  } 

  static async getById(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const project = await ProjectService.getProjectById(id);

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
      await ProjectService.deleteProject(id);

      return res.status(204).send();
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

  static async regenerateApiKey(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const { id } = req.params;
      const newApiKey = await ProjectService.regenerateApiKey(id);

      return res.status(200).json({
        status: "success",
        message: "API key regenerated successfully",
        data: {
          projectId: id,
          apiKey: newApiKey,
        },
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to regenerate API key"
      );
    }
  }

  static async getProjectStats(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const stats = await ProjectService.getProjectStats(id);

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

      const updatedProject = await ProjectService.removeTeamMember(
        projectId,
        userId
      );

      return res.status(200).json({
        status: "success",
        message: "Team member removed successfully",
        data: updatedProject,
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

  // Additional endpoints based on improved service
  static async searchProjects(req: Request, res: Response): Promise<Response> {
    try {
      const { q: query } = req.query;
      const limit = Math.min(
        50,
        Math.max(1, parseInt(req.query.limit as string) || 10)
      );

      if (!query || typeof query !== "string") {
        return res.status(400).json({
          status: "error",
          message: "Search query parameter 'q' is required",
        } as ApiResponse);
      }

      const results = await ProjectService.searchProjects(query, { limit });

      return res.status(200).json({
        status: "success",
        message: "Search completed successfully",
        data: results.results,
        meta: {
          query: results.query,
          count: results.count,
          limit,
        },
      } as ApiResponse);
    } catch (error) {
      return ProjectController.handleError(
        error as Error,
        res,
        "Failed to search projects"
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

  // Bulk operations
  static async bulkDelete(req: Request, res: Response): Promise<Response> {
    try {
      const { ids } = req.body;

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
          await ProjectService.deleteProject(id);
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

  // Health check endpoint
  static async healthCheck(req: Request, res: Response): Promise<Response> {
    try {
      // Simple count query to verify database connectivity
      const result = await ProjectService.getAllProjects({ page: 1, limit: 1 });

      return res.status(200).json({
        status: "success",
        message: "Project service is healthy",
        data: {
          timestamp: new Date().toISOString(),
          totalProjects: result.pagination.totalRecords,
        },
      } as ApiResponse);
    } catch (error) {
      return res.status(503).json({
        status: "error",
        message: "Project service is unhealthy",
        data: {
          timestamp: new Date().toISOString(),
          error: (error as Error).message,
        },
      } as ApiResponse);
    }
  }
}
