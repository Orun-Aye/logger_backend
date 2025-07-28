import { ProjectModel } from "../models/project.model";
import { CreateProjectDTO, UpdateProjectDTO } from "../dtos/project.dto";
import { v4 as uuidv4 } from "uuid";
import { Types, SortOrder } from "mongoose";

// Custom error classes for better error handling
export class ProjectNotFoundError extends Error {
  constructor(id: string) {
    super(`Project with ID ${id} not found`);
    this.name = "ProjectNotFoundError";
  }
}

export class ProjectValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectValidationError";
  }
}

export class ProjectService {
  // Input validation helper
  private static validateObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new ProjectValidationError(`Invalid project ID format: ${id}`);
    }
  }

  // Validation for create data
  private static validateCreateData(data: CreateProjectDTO): void {
    if (!data.name || data.name.trim().length === 0) {
      throw new ProjectValidationError("Project name is required");
    }
    if (data.name.length > 100) {
      throw new ProjectValidationError(
        "Project name cannot exceed 100 characters"
      );
    }
  }

  static async createProject(data: CreateProjectDTO) {
    try {
      this.validateCreateData(data);

      // Check for duplicate names
      const existingProject = await ProjectModel.findOne({
        name: data.name.trim(),
      });

      if (existingProject) {
        throw new ProjectValidationError(
          "Project with this name already exists"
        );
      }

      const apiKey = uuidv4();
      const project = new ProjectModel({
        ...data,
        name: data.name.trim(),
        ownerId: data.ownerId,
        teamMembers: [{ user: data.ownerId, role: "admin" }],
        apiKey,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const savedProject = await project.save();

      // Return only necessary fields
      return {
        id: savedProject._id,
        name: savedProject.name,
        description: savedProject.description,
        apiKey: savedProject.apiKey,
        createdAt: savedProject.createdAt,
        updatedAt: savedProject.updatedAt,
      };
    } catch (error) {
      if (error instanceof ProjectValidationError) {
        throw error;
      }
      throw new Error(`Failed to create project: ${error}`);
    }
  }

  static async getAllProjects(
    options: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    } = {}
  ) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = options;

      const skip = (page - 1) * limit;
      const sort: { [key: string]: SortOrder } = {
        [sortBy]: sortOrder === "desc" ? -1 : 1,
      };

      const [projects, total] = await Promise.all([
        ProjectModel.find()
          .select("-__v") // Exclude version key
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(), // Better performance for read-only operations
        ProjectModel.countDocuments(),
      ]);

      return {
        projects,
        pagination: {
          current: page,
          total: Math.ceil(total / limit),
          count: projects.length,
          order: sortOrder,
          totalRecords: total,
        },
      };
    } catch (error) {
      throw new Error(`Failed to fetch projects: ${error}`);
    }
  }

  static async getProjectsByUser(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
      searchBy?: 'owner' | 'teamMember' | 'both'
    } = {}
  ) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortOrder = "desc",
        searchBy = 'owner'
      } = options;

      const skip = (page - 1) * limit;
      const sort: { [key: string]: SortOrder } = {
        [sortBy]: sortOrder === "desc" ? -1 : 1,
      };

      this.validateObjectId(userId);
      const userObjectId = new Types.ObjectId(userId);

      let queryCondition: Record<string, any>

      if (searchBy === 'owner') {
        queryCondition = { ownerId: userObjectId };
      } else if (searchBy === 'teamMember') {
        queryCondition = { 'teamMembers.user': userObjectId };
      } else { // 'both'
        queryCondition = {
          $or: [
            { ownerId: userObjectId },
            { 'teamMembers.user': userObjectId },
          ],
        };
      }

      const [projects, total] = await Promise.all([
        ProjectModel.find(queryCondition)
          .select("-__v")
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
          ProjectModel.countDocuments(queryCondition)
      ]);

      return {
        projects,
        pagination: {
          current: page,
          total: Math.ceil(total / limit),
          count: projects.length,
          order: sortOrder,
          totalRecords: total
        }
      };
    } catch (error) {
      throw new Error(`Failed to fetch projects: ${error}`);
    }
  }

  static async getProjectById(id: string) {
    try {
      this.validateObjectId(id);

      const project = await ProjectModel.findById(id).select("-__v").lean();

      if (!project) {
        throw new ProjectNotFoundError(id);
      }

      return project;
    } catch (error) {
      if (
        error instanceof ProjectNotFoundError ||
        error instanceof ProjectValidationError
      ) {
        throw error;
      }
      throw new Error(`Failed to fetch project: ${error}`);
    }
  }

  static async updateProject(id: string, data: UpdateProjectDTO) {
    try {
      this.validateObjectId(id);

      // Check if project exists first
      const existingProject = await ProjectModel.findById(id);
      if (!existingProject) {
        throw new ProjectNotFoundError(id);
      }

      // Validate name if provided
      if (data.name !== undefined) {
        if (!data.name || data.name.trim().length === 0) {
          throw new ProjectValidationError("Project name cannot be empty");
        }
        if (data.name.length > 100) {
          throw new ProjectValidationError(
            "Project name cannot exceed 100 characters"
          );
        }

        // Check for duplicate names (excluding current project)
        const duplicateProject = await ProjectModel.findOne({
          name: data.name.trim(),
          _id: { $ne: id },
        });

        if (duplicateProject) {
          throw new ProjectValidationError(
            "Project with this name already exists"
          );
        }
      }

      const updateData = {
        ...data,
        ...(data.name && { name: data.name.trim() }),
        updatedAt: new Date(),
      };

      const updatedProject = await ProjectModel.findByIdAndUpdate(
        id,
        updateData,
        {
          new: true,
          runValidators: true,
          select: "-__v",
        }
      ).lean();

      return updatedProject;
    } catch (error) {
      if (
        error instanceof ProjectNotFoundError ||
        error instanceof ProjectValidationError
      ) {
        throw error;
      }
      throw new Error(`Failed to update project: ${error}`);
    }
  }

  static async deleteProject(id: string) {
    try {
      this.validateObjectId(id);

      const deletedProject = await ProjectModel.findByIdAndDelete(id);

      if (!deletedProject) {
        throw new ProjectNotFoundError(id);
      }

      return { success: true, deletedId: id };
    } catch (error) {
      if (
        error instanceof ProjectNotFoundError ||
        error instanceof ProjectValidationError
      ) {
        throw error;
      }
      throw new Error(`Failed to delete project: ${error}`);
    }
  }

  static async regenerateApiKey(id: string) {
    try {
      this.validateObjectId(id);

      const newKey = uuidv4();

      const updatedProject = await ProjectModel.findByIdAndUpdate(
        id,
        {
          apiKey: newKey,
          updatedAt: new Date(),
        },
        { new: true }
      );

      if (!updatedProject) {
        throw new ProjectNotFoundError(id);
      }

      return newKey;
    } catch (error) {
      if (
        error instanceof ProjectNotFoundError ||
        error instanceof ProjectValidationError
      ) {
        throw error;
      }
      throw new Error(`Failed to regenerate API key: ${error}`);
    }
  }

  static async getProjectStats(id: string) {
    try {
      this.validateObjectId(id);

      const project = await ProjectModel.findById(id)
        .select("logCount alertRulesCount lastIngestedAt name")
        .lean();

      if (!project) {
        throw new ProjectNotFoundError(id);
      }

      return {
        projectId: id,
        projectName: project.name,
        logCount: project.logCount || 0,
        alertRulesCount: project.alertRuleCount || 0,
        lastIngestedAt: project.lastIngestedAt,
        statsGeneratedAt: new Date(),
      };
    } catch (error) {
      if (
        error instanceof ProjectNotFoundError ||
        error instanceof ProjectValidationError
      ) {
        throw error;
      }
      throw new Error(`Failed to get project stats: ${error}`);
    }
  }

  // Additional utility methods
  static async getProjectByApiKey(apiKey: string) {
    try {
      if (!apiKey) {
        throw new ProjectValidationError("API key is required");
      }

      const project = await ProjectModel.findOne({ apiKey })
        .select("-__v")
        .lean();

      if (!project) {
        throw new ProjectNotFoundError(`project with API key`);
      }

      return project;
    } catch (error) {
      if (
        error instanceof ProjectNotFoundError ||
        error instanceof ProjectValidationError
      ) {
        throw error;
      }
      throw new Error(`Failed to find project by API key: ${error}`);
    }
  }

  static async searchProjects(query: string, options: { limit?: number } = {}) {
    try {
      const { limit = 10 } = options;

      if (!query || query.trim().length === 0) {
        throw new ProjectValidationError("Search query is required");
      }

      const searchRegex = new RegExp(query.trim(), "i");

      const projects = await ProjectModel.find({
        $or: [{ name: searchRegex }, { description: searchRegex }],
      })
        .select("-__v -apiKey") // Don't expose API keys in search
        .limit(limit)
        .lean();

      return {
        query: query.trim(),
        results: projects,
        count: projects.length,
      };
    } catch (error) {
      if (error instanceof ProjectValidationError) {
        throw error;
      }
      throw new Error(`Failed to search projects: ${error}`);
    }
  }

  static async addTeamMember(
    projectId: string,
    userId: string,
    role: "admin" | "viewer"
  ) {
    try {
      this.validateObjectId(projectId);
      this.validateObjectId(userId);

      const project = await ProjectModel.findById(projectId);
      if (!project) {
        throw new ProjectNotFoundError(projectId);
      }

      // Check if user is already a team member
      const existingMember = project.teamMembers.find(
        (member) => member.user.toString() === userId
      );

      if (existingMember) {
        throw new ProjectValidationError(
          "User is already a team member of this project"
        );
      }

      project.teamMembers.push({ user: new Types.ObjectId(userId), role });
      project.updatedAt = new Date();
      const updatedProject = await project.save();
      return {
        projectId: updatedProject._id,
        teamMember: {
          userId: userId,
          role: role,
        },
      };
    } catch (error) {
      if (
        error instanceof ProjectNotFoundError ||
        error instanceof ProjectValidationError
      ) {
        throw error;
      }
      throw new Error(`Failed to add team member: ${error}`);
    }
  }

  static async removeTeamMember(projectId: string, userId: string) {
    try {
      this.validateObjectId(projectId);
      this.validateObjectId(userId);

      const project = await ProjectModel.findById(projectId);
      if (!project) {
        throw new ProjectNotFoundError(projectId);
      }

      const memberIndex = project.teamMembers.findIndex(
        (member) => member.user.toString() === userId
      );

      if (memberIndex === -1) {
        throw new ProjectValidationError(
          "User is not a team member of this project"
        );
      }

      project.teamMembers.splice(memberIndex, 1);
      project.updatedAt = new Date();
      const updatedProject = await project.save();
      return {
        projectId: updatedProject._id,
        removedUserId: userId,
      };
    } catch (error) {
      if (
        error instanceof ProjectNotFoundError ||
        error instanceof ProjectValidationError
      ) {
        throw error;
      }
      throw new Error(`Failed to remove team member: ${error}`);
    }
  }

  static async updateTeamMemberRole(
    projectId: string,
    userId: string,
    role: "admin" | "viewer"
  ) {
    try {
      this.validateObjectId(projectId);
      this.validateObjectId(userId);

      const project = await ProjectModel.findById(projectId);
      if (!project) {
        throw new ProjectNotFoundError(projectId);
      }

      const member = project.teamMembers.find(
        (member) => member.user.toString() === userId
      );

      if (!member) {
        throw new ProjectValidationError(
          "User is not a team member of this project"
        );
      }

      member.role = role;
      project.updatedAt = new Date();
      const updatedProject = await project.save();
      return {
        projectId: updatedProject._id,
        updatedUser: {
          userId: userId,
          role: role,
        },
      };
    } catch (error) {
      if (
        error instanceof ProjectNotFoundError ||
        error instanceof ProjectValidationError
      ) {
        throw error;
      }
      throw new Error(`Failed to update team member role: ${error}`);
    }
  }
}
