import { ProjectModel } from "../models/project.model";
import { CreateProjectDTO, UpdateProjectDTO } from "../dtos/project.dto";
import { v4 as uuidv4 } from "uuid";
import { Types, SortOrder } from "mongoose";
import { LogModel } from "../models/log.model";

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

export class ProjectOperationError extends Error {
  constructor(message: string, context?: any) {
    super(message);
    this.name = "ProjectOperationError";
  }
}

export interface ProjectsSummaryData {
  summary: {
    totalProjects: number;
    activeProjects: number;
    inactiveProjects: number;
    totalLogsOverall: number; // New field for total logs across all projects
    avgLogsPerProject: number; // New field for average logs per project
    maxLogsPerProject: number; // Added field for max logs per project
    minLogsPerProject: number; // Added field for min logs per project
  };
  recentProjects: Array<{
    name: string;
    logCount?: number;
    lastIngestedAt?: Date;
    _id: Types.ObjectId;
  }>;
  topProjectsByLogs: Array<{
    name: string;
    logCount?: number;
    _id: Types.ObjectId;
  }>;
  popularTags: Array<{ _id: string; count: number }>;
  creationTrends?: Array<{ _id: string; count: number }>; // Optional, if groupBy is used
  metadata: {
    responseTime: number;
    cacheHit: boolean;
    queryCount: number;
    userId: string | null;
    filters: {
      includeInactive: boolean;
      dateRange: {
        startDate: Date | undefined;
        endDate: Date | undefined;
      } | null;
      groupBy: "day" | "week" | "month";
    };
    generatedAt: Date;
  };
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

  private static async updateLogCount(projectId: string): Promise<number> {
    try {
      const logCount = await LogModel.countDocuments({ projectId });
      await ProjectModel.findByIdAndUpdate(projectId, {
        logCount,
        lastIngestedAt: new Date(),
      });
      return logCount;
    } catch (error) {
      throw new ProjectOperationError(`Failed to update log count: ${error}`);
    }
  }

  private static async recalculateProjectStats(projectId: string) {
    try {
      const [logCount, lastLog] = await Promise.all([
        LogModel.countDocuments({ projectId }),
        LogModel.findOne({ projectId })
          .sort({ timestamp: -1 })
          .select("timestamp")
          .lean(),
      ]);

      const updateData: any = { logCount };
      if (lastLog) {
        updateData.lastIngestedAt = new Date(lastLog.timestamp);
      }

      await ProjectModel.findByIdAndUpdate(projectId, updateData);
      return { logCount, lastIngestedAt: lastLog?.timestamp };
    } catch (error) {
      throw new ProjectOperationError(
        `Failed to recalculate project stats: ${error}`
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
        isActive: savedProject.isActive,
        logCount: savedProject.logCount,
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
      includeInactive?: boolean;
      tags?: string[];
    } = {}
  ) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortOrder = "desc",
        includeInactive = false,
        tags,
      } = options;

      const skip = (page - 1) * limit;
      const sort: { [key: string]: SortOrder } = {
        [sortBy]: sortOrder === "desc" ? -1 : 1,
      };

      const filter: any = {};
      if (!includeInactive) {
        filter.isActive = true;
      }
      if (tags && tags.length > 0) {
        filter.tags = { $in: tags };
      }

      const [projects, total] = await Promise.all([
        ProjectModel.find(filter)
          .select("-__v") // Exclude version key
          .populate("ownerId", "firstName lastName email")
          .populate("teamMembers.user", "firstName lastName email")
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(), // Better performance for read-only operations
        ProjectModel.countDocuments(filter),
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
      searchBy?: "owner" | "teamMember" | "both";
      includeInactive?: boolean;
    } = {}
  ) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortOrder = "desc",
        searchBy = "owner",
        includeInactive = false,
      } = options;

      const skip = (page - 1) * limit;
      const sort: { [key: string]: SortOrder } = {
        [sortBy]: sortOrder === "desc" ? -1 : 1,
      };

      this.validateObjectId(userId);
      const userObjectId = new Types.ObjectId(userId);

      let queryCondition: Record<string, any> = {};

      if (searchBy === "owner") {
        queryCondition.ownerId = userObjectId;
      } else if (searchBy === "teamMember") {
        queryCondition["teamMembers.user"] = userObjectId;
      } else {
        // 'both'
        queryCondition.$or = [
          { ownerId: userObjectId },
          { "teamMembers.user": userObjectId },
        ];
      }

      if (!includeInactive) {
        queryCondition.isActive = true;
      }

      const [projects, total] = await Promise.all([
        ProjectModel.find(queryCondition)
          .select("-__v")
          .populate("ownerId", "firstName lastName email")
          .populate("teamMembers.user", "firstName lastName email")
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        ProjectModel.countDocuments(queryCondition),
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

  static async getProjectById(id: string, populateRefs: boolean = false) {
    try {
      this.validateObjectId(id);

      let query = ProjectModel.findById(id).select("-__v");

      if (populateRefs) {
        query = query
          .populate("ownerId", "firstName lastName email")
          .populate("teamMembers.user", "firstName lastName email");
      }

      const project = await query.lean();

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

  static async deleteProject(id: string, softDelete: boolean = true) {
    try {
      this.validateObjectId(id);

      if (softDelete) {
        const updatedProject = await ProjectModel.findByIdAndUpdate(
          id,
          { isActive: false, updatedAt: new Date() },
          { new: true }
        );

        if (!updatedProject) {
          throw new ProjectNotFoundError(id);
        }

        return { success: true, deletedId: id, type: "soft" };
      } else {
        const deletedProject = await ProjectModel.findByIdAndDelete(id);

        if (!deletedProject) {
          throw new ProjectNotFoundError(id);
        }

        // TODO: Consider also deleting associated logs
        LogModel.deleteMany({ projectId: id });

        return { success: true, deletedId: id, type: "hard" };
      }
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

  static async restoreProject(id: string) {
    try {
      this.validateObjectId(id);

      const restoredProject = await ProjectModel.findByIdAndUpdate(
        id,
        { isActive: true, updatedAt: new Date() },
        { new: true }
      );

      if (!restoredProject) {
        throw new ProjectNotFoundError(id);
      }

      return { success: true, restoredId: id };
    } catch (error) {
      if (
        error instanceof ProjectNotFoundError ||
        error instanceof ProjectValidationError
      ) {
        throw error;
      }
      throw new Error(`Failed to restore project: ${error}`);
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

      return {
        apiKey: newKey,
        projectId: id,
        regeneratedAt: new Date(),
      };
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

  static async getProjectStats(id: string, recalculate: boolean = false) {
    try {
      this.validateObjectId(id);

      if (recalculate) {
        await this.recalculateProjectStats(id);
      }

      const project = await ProjectModel.findById(id)
        .select("logCount alertRuleCount lastIngestedAt name isActive tags")
        .lean();

      if (!project) {
        throw new ProjectNotFoundError(id);
      }

      // Get additional stats from logs collection
      const [errorLogsCount, warningLogsCount, recentLogsCount, topLevels] =
        await Promise.all([
          LogModel.countDocuments({ projectId: id, level: "error" }),
          LogModel.countDocuments({ projectId: id, level: "warn" }),
          LogModel.countDocuments({
            projectId: id,
            timestamp: {
              $gte: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            },
          }),
          LogModel.aggregate([
            { $match: { projectId: id } },
            { $group: { _id: "$level", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
          ]),
        ]);

      return {
        projectId: id,
        projectName: project.name,
        isActive: project.isActive,
        logCount: project.logCount || 0,
        alertRulesCount: project.alertRuleCount || 0,
        errorLogsCount,
        warningLogsCount,
        recentLogsCount,
        topLogLevels: topLevels,
        tags: project.tags || [],
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

  static async syncLogCount(projectId: string) {
    try {
      this.validateObjectId(projectId);

      const project = await ProjectModel.findById(projectId);
      if (!project) {
        throw new ProjectNotFoundError(projectId);
      }

      const actualCount = await this.updateLogCount(projectId);

      return {
        projectId,
        previousCount: project.logCount || 0,
        actualCount,
        synced: true,
        syncedAt: new Date(),
      };
    } catch (error) {
      if (
        error instanceof ProjectNotFoundError ||
        error instanceof ProjectValidationError
      ) {
        throw error;
      }
      throw new Error(`Failed to sync log count: ${error}`);
    }
  }

  static async incrementLogCount(projectId: string, increment: number = 1) {
    try {
      this.validateObjectId(projectId);

      const updatedProject = await ProjectModel.findByIdAndUpdate(
        projectId,
        {
          $inc: { logCount: increment },
          lastIngestedAt: new Date(),
        },
        { new: true }
      );

      if (!updatedProject) {
        throw new ProjectNotFoundError(projectId);
      }

      return {
        projectId,
        newCount: updatedProject.logCount,
        increment,
      };
    } catch (error) {
      throw new ProjectOperationError(
        `Failed to increment log count: ${error}`
      );
    }
  }

  static async syncAllProjectLogCounts() {
    try {
      const projects = await ProjectModel.find({ isActive: true })
        .select("_id")
        .lean();
      const results = [];

      for (const project of projects) {
        try {
          const result = await this.syncLogCount(project._id.toString());
          results.push(result);
        } catch (error) {
          results.push({
            projectId: project._id.toString(),
            error: error instanceof Error ? error.message : String(error),
            synced: false,
          });
        }
      }

      return {
        totalProjects: projects.length,
        syncedProjects: results.filter((r) => r.synced).length,
        failedProjects: results.filter((r) => !r.synced).length,
        results,
        syncedAt: new Date(),
      };
    } catch (error) {
      throw new Error(`Failed to sync all project log counts: ${error}`);
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

  static async searchProjects(
    query: string,
    options: {
      limit?: number;
      includeInactive?: boolean;
      tags?: string[];
      userId?: string;
    } = {}
  ) {
    try {
      const { limit = 10, includeInactive = false, tags, userId } = options;

      if (!query || query.trim().length === 0) {
        throw new ProjectValidationError("Search query is required");
      }

      const searchRegex = new RegExp(query.trim(), "i");

      const filter: any = {
        $or: [{ name: searchRegex }, { description: searchRegex }],
      };

      if (!includeInactive) {
        filter.isActive = true;
      }

      if (tags && tags.length > 0) {
        filter.tags = { $in: tags };
      }

      if (userId) {
        this.validateObjectId(userId);
        const userObjectId = new Types.ObjectId(userId);
        filter.$and = [
          filter.$or ? { $or: filter.$or } : {},
          {
            $or: [
              { ownerId: userObjectId },
              { "teamMembers.user": userObjectId },
            ],
          },
        ];
        delete filter.$or;
      }

      const projects = await ProjectModel.find(filter)
        .select("-__v -apiKey") // Don't expose API keys in search
        .populate("ownerId", "name email")
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

  // Tag management methods
  static async addProjectTags(projectId: string, tags: string[]) {
    try {
      this.validateObjectId(projectId);

      if (!tags || tags.length === 0) {
        throw new ProjectValidationError("At least one tag is required");
      }

      const cleanTags = tags
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0);

      const updatedProject = await ProjectModel.findByIdAndUpdate(
        projectId,
        {
          $addToSet: { tags: { $each: cleanTags } },
          updatedAt: new Date(),
        },
        { new: true }
      );

      if (!updatedProject) {
        throw new ProjectNotFoundError(projectId);
      }

      return {
        projectId,
        addedTags: cleanTags,
        allTags: updatedProject.tags,
      };
    } catch (error) {
      if (
        error instanceof ProjectNotFoundError ||
        error instanceof ProjectValidationError
      ) {
        throw error;
      }
      throw new Error(`Failed to add project tags: ${error}`);
    }
  }

  static async removeProjectTags(projectId: string, tags: string[]) {
    try {
      this.validateObjectId(projectId);

      if (!tags || tags.length === 0) {
        throw new ProjectValidationError("At least one tag is required");
      }

      const cleanTags = tags.map((tag) => tag.trim().toLowerCase());

      const updatedProject = await ProjectModel.findByIdAndUpdate(
        projectId,
        {
          $pull: { tags: { $in: cleanTags } },
          updatedAt: new Date(),
        },
        { new: true }
      );

      if (!updatedProject) {
        throw new ProjectNotFoundError(projectId);
      }

      return {
        projectId,
        removedTags: cleanTags,
        allTags: updatedProject.tags,
      };
    } catch (error) {
      if (
        error instanceof ProjectNotFoundError ||
        error instanceof ProjectValidationError
      ) {
        throw error;
      }
      throw new Error(`Failed to remove project tags: ${error}`);
    }
  }

  // Rate limit configuration methods
  static async updateRateLimitConfig(
    projectId: string,
    config: { maxRequestsPerMinute?: number; burstLimit?: number }
  ) {
    try {
      this.validateObjectId(projectId);

      if (config.maxRequestsPerMinute && config.maxRequestsPerMinute < 1) {
        throw new ProjectValidationError(
          "Max requests per minute must be at least 1"
        );
      }

      if (config.burstLimit && config.burstLimit < 1) {
        throw new ProjectValidationError("Burst limit must be at least 1");
      }

      const updateData: any = { updatedAt: new Date() };

      if (config.maxRequestsPerMinute !== undefined) {
        updateData["rateLimitConfig.maxRequestsPerMinute"] =
          config.maxRequestsPerMinute;
      }

      if (config.burstLimit !== undefined) {
        updateData["rateLimitConfig.burstLimit"] = config.burstLimit;
      }

      const updatedProject = await ProjectModel.findByIdAndUpdate(
        projectId,
        updateData,
        { new: true }
      );

      if (!updatedProject) {
        throw new ProjectNotFoundError(projectId);
      }

      return {
        projectId,
        rateLimitConfig: updatedProject.rateLimitConfig,
      };
    } catch (error) {
      if (
        error instanceof ProjectNotFoundError ||
        error instanceof ProjectValidationError
      ) {
        throw error;
      }
      throw new Error(`Failed to update rate limit config: ${error}`);
    }
  }

  // Team member management methods (existing methods updated)
  static async addTeamMember(
    projectId: string,
    userId: string,
    role: "admin" | "viewer" = "viewer"
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
        totalMembers: updatedProject.teamMembers.length,
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

      // Prevent removing the owner
      if (project.ownerId?.toString() === userId) {
        throw new ProjectValidationError(
          "Cannot remove project owner from team members"
        );
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
        totalMembers: updatedProject.teamMembers.length,
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

  static async getTeamMembers(projectId: string) {
    try {
      this.validateObjectId(projectId);

      const project = await ProjectModel.findById(projectId)
        .select("teamMembers ownerId")
        .populate("teamMembers.user", "firstName lastName email")
        .populate("ownerId", "firstName lastName email")
        .lean();

      if (!project) {
        throw new ProjectNotFoundError(projectId);
      }

      return {
        projectId,
        owner: project.ownerId,
        teamMembers: project.teamMembers,
        totalMembers: project.teamMembers.length,
      };
    } catch (error) {
      if (
        error instanceof ProjectNotFoundError ||
        error instanceof ProjectValidationError
      ) {
        throw error;
      }
      throw new Error(`Failed to get team members: ${error}`);
    }
  }

  // Bulk operations
  static async bulkUpdateProjects(
    projectIds: string[],
    updateData: Partial<{
      isActive: boolean;
      tags: string[];
      rateLimitConfig: { maxRequestsPerMinute: number; burstLimit: number };
    }>
  ) {
    try {
      projectIds.forEach((id) => this.validateObjectId(id));

      const result = await ProjectModel.updateMany(
        { _id: { $in: projectIds } },
        {
          ...updateData,
          updatedAt: new Date(),
        }
      );

      return {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        updatedFields: Object.keys(updateData),
      };
    } catch (error) {
      throw new Error(`Failed to bulk update projects: ${error}`);
    }
  }

  static async getProjectsAnalytics(
    options: {
      startDate?: Date;
      endDate?: Date;
      groupBy?: "day" | "week" | "month";
    } = {}
  ) {
    try {
      const { startDate, endDate, groupBy = "day" } = options;

      const matchStage: any = {};
      if (startDate || endDate) {
        matchStage.createdAt = {};
        if (startDate) matchStage.createdAt.$gte = startDate;
        if (endDate) matchStage.createdAt.$lte = endDate;
      }

      const [creationTrends, tagDistribution, totalStats] = await Promise.all([
        ProjectModel.aggregate([
          ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),
          {
            $group: {
              _id: {
                $dateToString: {
                  format:
                    groupBy === "day"
                      ? "%Y-%m-%d"
                      : groupBy === "week"
                      ? "%Y-%U"
                      : "%Y-%m",
                  date: "$createdAt",
                },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        ProjectModel.aggregate([
          { $unwind: "$tags" },
          { $group: { _id: "$tags", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
        ProjectModel.aggregate([
          {
            $facet: {
              totalProjects: [{ $count: "count" }],
              activeProjects: [
                { $match: { isActive: true } },
                { $count: "count" },
              ],
              totalLogs: [
                {
                  $lookup: {
                    from: "logs",
                    localField: "_id",
                    foreignField: "projectId",
                    as: "logs",
                  },
                },
                { $unwind: "$logs" },
                { $count: "count" },
              ],
            },
          },
          {
            $project: {
              totalProjects: { $arrayElemAt: ["$totalProjects.count", 0] },
              activeProjects: { $arrayElemAt: ["$activeProjects.count", 0] },
              totalLogs: { $arrayElemAt: ["$totalLogs.count", 0] },
            },
          },
          {
            $addFields: {
              avgLogsPerProject: {
                $cond: [
                  { $gt: ["$totalProjects", 0] },
                  { $divide: ["$totalLogs", "$totalProjects"] },
                  0,
                ],
              },
            },
          },
        ]),
      ]);

      return {
        totalStats: totalStats[0] || {
          totalProjects: 0,
          activeProjects: 0,
          totalLogs: 0,
          avgLogsPerProject: 0,
        },
        creationTrends,
        tagDistribution,
        generatedAt: new Date(),
      };
    } catch (error) {
      throw new Error(`Failed to get projects analytics: ${error}`);
    }
  }

  // Export/Import functionality
  static async exportProjectData(
    projectId: string,
    options: {
      includeLogs?: boolean;
      dateRange?: { start: Date; end: Date };
      format?: "json" | "csv";
    } = {}
  ) {
    try {
      this.validateObjectId(projectId);

      const project = await ProjectModel.findById(projectId)
        .populate("ownerId", "name email")
        .populate("teamMembers.user", "name email")
        .lean();

      if (!project) {
        throw new ProjectNotFoundError(projectId);
      }

      const exportData: any = {
        project,
        exportedAt: new Date(),
        exportOptions: options,
      };

      if (options.includeLogs) {
        const logQuery: any = { projectId };

        if (options.dateRange) {
          logQuery.timestamp = {
            $gte: options.dateRange.start.toISOString(),
            $lte: options.dateRange.end.toISOString(),
          };
        }

        const logs = await LogModel.find(logQuery).lean();
        exportData.logs = logs;
        exportData.logCount = logs.length;
      }

      return exportData;
    } catch (error) {
      if (
        error instanceof ProjectNotFoundError ||
        error instanceof ProjectValidationError
      ) {
        throw error;
      }
      throw new Error(`Failed to export project data: ${error}`);
    }
  }

  // Health check and maintenance methods
  static async healthCheck() {
    try {
      const [totalProjects, activeProjects, projectsWithLogs, recentActivity] =
        await Promise.all([
          ProjectModel.countDocuments(),
          ProjectModel.countDocuments({ isActive: true }),
          ProjectModel.countDocuments({ logCount: { $gt: 0 } }),
          ProjectModel.countDocuments({
            lastIngestedAt: {
              $gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
            },
          }),
        ]);

      return {
        status: "healthy",
        metrics: {
          totalProjects,
          activeProjects,
          inactiveProjects: totalProjects - activeProjects,
          projectsWithLogs,
          projectsWithRecentActivity: recentActivity,
        },
        checkedAt: new Date(),
      };
    } catch (error) {
      return {
        status: "unhealthy",
        error: error instanceof Error ? error.message : String(error),
        checkedAt: new Date(),
      };
    }
  }

  // Project archival system
  static async archiveProject(projectId: string, archiveReason?: string) {
    try {
      this.validateObjectId(projectId);

      const project = await ProjectModel.findById(projectId);
      if (!project) {
        throw new ProjectNotFoundError(projectId);
      }

      if (!project.isActive) {
        throw new ProjectValidationError("Project is already archived");
      }

      const archiveData = {
        isActive: false,
        archivedAt: new Date(),
        archiveReason: archiveReason || "Manual archive",
        updatedAt: new Date(),
      };

      const archivedProject = await ProjectModel.findByIdAndUpdate(
        projectId,
        archiveData,
        { new: true }
      );

      if (!archivedProject) {
        throw new ProjectNotFoundError(projectId);
      }

      return {
        projectId,
        projectName: archivedProject.name,
        archivedAt: archiveData.archivedAt,
        reason: archiveData.archiveReason,
      };
    } catch (error) {
      if (
        error instanceof ProjectNotFoundError ||
        error instanceof ProjectValidationError
      ) {
        throw error;
      }
      throw new Error(`Failed to archive project: ${error}`);
    }
  }

  // Project duplication
  static async duplicateProject(
    sourceProjectId: string,
    newName: string,
    ownerId: string,
    options: {
      copyTeamMembers?: boolean;
      copyTags?: boolean;
      copyRateLimitConfig?: boolean;
    } = {}
  ) {
    try {
      this.validateObjectId(sourceProjectId);
      this.validateObjectId(ownerId);

      const sourceProject = await ProjectModel.findById(sourceProjectId);
      if (!sourceProject) {
        throw new ProjectNotFoundError(sourceProjectId);
      }

      // Check if new name is available
      const existingProject = await ProjectModel.findOne({
        name: newName.trim(),
      });
      if (existingProject) {
        throw new ProjectValidationError(
          "Project with this name already exists"
        );
      }

      const {
        copyTeamMembers = false,
        copyTags = true,
        copyRateLimitConfig = true,
      } = options;

      const newProjectData: any = {
        name: newName.trim(),
        description: sourceProject.description,
        ownerId: new Types.ObjectId(ownerId),
        apiKey: uuidv4(),
        isActive: true,
        logCount: 0,
        alertRuleCount: 0,
        teamMembers: [{ user: new Types.ObjectId(ownerId), role: "admin" }],
      };

      if (copyTeamMembers && sourceProject.teamMembers.length > 0) {
        // Add original team members (excluding the new owner if they're already a member)
        const additionalMembers = sourceProject.teamMembers.filter(
          (member) => member.user.toString() !== ownerId
        );
        newProjectData.teamMembers.push(...additionalMembers);
      }

      if (copyTags && sourceProject.tags && sourceProject.tags.length > 0) {
        newProjectData.tags = [...sourceProject.tags];
      }

      if (copyRateLimitConfig && sourceProject.rateLimitConfig) {
        newProjectData.rateLimitConfig = { ...sourceProject.rateLimitConfig };
      }

      if (sourceProject.integrationSettings) {
        newProjectData.integrationSettings = {
          ...sourceProject.integrationSettings,
        };
      }

      const duplicatedProject = new ProjectModel(newProjectData);
      const savedProject = await duplicatedProject.save();

      return {
        sourceProjectId,
        newProjectId: savedProject._id,
        newProjectName: savedProject.name,
        copiedElements: {
          teamMembers: copyTeamMembers,
          tags: copyTags,
          rateLimitConfig: copyRateLimitConfig,
        },
        createdAt: savedProject.createdAt,
      };
    } catch (error) {
      if (
        error instanceof ProjectNotFoundError ||
        error instanceof ProjectValidationError
      ) {
        throw error;
      }
      throw new Error(`Failed to duplicate project: ${error}`);
    }
  }

  // Project transfer ownership
  static async transferOwnership(
    projectId: string,
    newOwnerId: string,
    currentOwnerId: string
  ) {
    try {
      this.validateObjectId(projectId);
      this.validateObjectId(newOwnerId);
      this.validateObjectId(currentOwnerId);

      const project = await ProjectModel.findById(projectId);
      if (!project) {
        throw new ProjectNotFoundError(projectId);
      }

      // Verify current ownership
      if (project.ownerId?.toString() !== currentOwnerId) {
        throw new ProjectValidationError(
          "Only the current owner can transfer ownership"
        );
      }

      // Check if new owner is already a team member
      const newOwnerMember = project.teamMembers.find(
        (member) => member.user.toString() === newOwnerId
      );

      // Update ownership
      project.ownerId = new Types.ObjectId(newOwnerId);

      // Ensure new owner is in team members with admin role
      if (newOwnerMember) {
        newOwnerMember.role = "admin";
      } else {
        project.teamMembers.push({
          user: new Types.ObjectId(newOwnerId),
          role: "admin",
        });
      }

      // Optionally keep previous owner as team member
      const previousOwnerMember = project.teamMembers.find(
        (member) => member.user.toString() === currentOwnerId
      );

      if (!previousOwnerMember) {
        project.teamMembers.push({
          user: new Types.ObjectId(currentOwnerId),
          role: "admin",
        });
      }

      project.updatedAt = new Date();
      const updatedProject = await project.save();

      return {
        projectId,
        projectName: updatedProject.name,
        previousOwnerId: currentOwnerId,
        newOwnerId,
        transferredAt: new Date(),
      };
    } catch (error) {
      if (
        error instanceof ProjectNotFoundError ||
        error instanceof ProjectValidationError
      ) {
        throw error;
      }
      throw new Error(`Failed to transfer project ownership: ${error}`);
    }
  }

  // Integration settings management
  static async updateIntegrationSettings(
    projectId: string,
    integrationSettings: Record<string, any>
  ) {
    try {
      this.validateObjectId(projectId);

      const updatedProject = await ProjectModel.findByIdAndUpdate(
        projectId,
        {
          integrationSettings,
          updatedAt: new Date(),
        },
        { new: true }
      );

      if (!updatedProject) {
        throw new ProjectNotFoundError(projectId);
      }

      return {
        projectId,
        integrationSettings: updatedProject.integrationSettings,
        updatedAt: updatedProject.updatedAt,
      };
    } catch (error) {
      if (
        error instanceof ProjectNotFoundError ||
        error instanceof ProjectValidationError
      ) {
        throw error;
      }
      throw new Error(`Failed to update integration settings: ${error}`);
    }
  }

  static async getProjectsSummary(
    userId?: string,
    options: {
      groupBy?: "day" | "week" | "month";
      startDate?: Date;
      endDate?: Date;
      includeInactive?: boolean;
      limit?: number;
    } = {}
  ): Promise<ProjectsSummaryData> {
    try {
      const {
        groupBy = "day",
        startDate,
        endDate,
        includeInactive = false,
        limit = 5,
      } = options;

      // Base query to filter by user ownership/membership if userId is provided
      const userFilter = userId
        ? {
            $or: [
              { ownerId: new Types.ObjectId(userId) },
              { "teamMembers.user": new Types.ObjectId(userId) },
            ],
          }
        : {};

      // Date range filter for creation trends
      const dateFilter: any = {};
      if (startDate || endDate) {
        dateFilter.createdAt = {};
        if (startDate) dateFilter.createdAt.$gte = startDate;
        if (endDate) dateFilter.createdAt.$lte = endDate;
      }

      // Active filter
      const activeFilter = includeInactive ? {} : { isActive: true };

      // All promises run concurrently
      const [
        totalProjectsCount,
        activeProjectsCount,
        recentProjects,
        topProjectsByLogs,
        popularTags,
        overallStats,
        creationTrends,
      ] = await Promise.all([
        // 1. Total Projects Count (matching user filter)
        ProjectModel.countDocuments(userFilter),

        // 2. Active Projects Count (matching user filter)
        ProjectModel.countDocuments({ ...userFilter, isActive: true }),

        // 3. Recent Projects (active, sorted by last update)
        ProjectModel.find({ ...userFilter, ...activeFilter })
          .sort({ updatedAt: -1 })
          .limit(limit)
          .select("name logCount lastIngestedAt createdAt ownerId tags")
          .populate("ownerId", "name email")
          .lean(),

        // 4. Top Projects by Log Count (active, sorted by logCount)
        ProjectModel.find({ ...userFilter, ...activeFilter })
          .sort({ logCount: -1 })
          .limit(limit)
          .select("name logCount createdAt")
          .lean(),

        // 5. Popular Tags (active projects, matching user filter)
        ProjectModel.aggregate([
          { $match: { ...userFilter, ...activeFilter } },
          { $unwind: { path: "$tags", preserveNullAndEmptyArrays: false } },
          {
            $group: {
              _id: "$tags",
              count: { $sum: 1 },
              projectIds: { $addToSet: "$_id" }, // Track which projects use this tag
            },
          },
          { $match: { _id: { $nin: [null, ""] } } }, // Exclude null/empty tags
          { $sort: { count: -1 } },
          { $limit: 10 },
          {
            $project: {
              _id: 1,
              count: 1,
              projectCount: { $size: "$projectIds" }, // How many unique projects use this tag
            },
          },
        ]),

        // 6. Overall Stats with better error handling
        ProjectModel.aggregate([
          { $match: { ...userFilter } },
          {
            $group: {
              _id: null,
              totalProjects: { $sum: 1 },
              activeProjects: { $sum: { $cond: ["$isActive", 1, 0] } },
              totalLogs: { $sum: { $ifNull: ["$logCount", 0] } }, // Handle null logCount
              avgLogsPerProject: { $avg: { $ifNull: ["$logCount", 0] } },
              maxLogs: { $max: { $ifNull: ["$logCount", 0] } },
              minLogs: { $min: { $ifNull: ["$logCount", 0] } },
            },
          },
          {
            $project: {
              _id: 0,
              totalProjects: 1,
              activeProjects: 1,
              totalLogs: 1,
              avgLogsPerProject: {
                $round: [{ $ifNull: ["$avgLogsPerProject", 0] }, 1],
              },
              maxLogs: 1,
              minLogs: 1,
              inactiveProjects: {
                $subtract: ["$totalProjects", "$activeProjects"],
              },
            },
          },
        ]),

        // 7. Creation Trends (conditional based on groupBy parameter)
        groupBy
          ? ProjectModel.aggregate([
              { $match: { ...userFilter, ...dateFilter } },
              {
                $group: {
                  _id: {
                    $dateToString: {
                      format:
                        groupBy === "day"
                          ? "%Y-%m-%d"
                          : groupBy === "week"
                          ? "%Y-%U"
                          : "%Y-%m",
                      date: "$createdAt",
                    },
                  },
                  count: { $sum: 1 },
                  activeCount: { $sum: { $cond: ["$isActive", 1, 0] } },
                },
              },
              { $sort: { _id: 1 } },
              { $limit: 50 }, // Prevent excessive data
            ])
          : Promise.resolve([]),
      ]);

      // Extract the single result from overallStats aggregation
      const overallSummary = overallStats[0] || {
        totalProjects: 0,
        activeProjects: 0,
        inactiveProjects: 0,
        totalLogs: 0,
        avgLogsPerProject: 0,
        maxLogs: 0,
        minLogs: 0,
      };

      // Add performance metrics
      const performanceMetrics = {
        responseTime: Date.now(), // You'd calculate this properly
        cacheHit: false, // Implement caching logic
        queryCount: 7,
      };

      return {
        summary: {
          totalProjects: overallSummary.totalProjects,
          activeProjects: overallSummary.activeProjects,
          inactiveProjects: overallSummary.inactiveProjects,
          totalLogsOverall: overallSummary.totalLogs,
          avgLogsPerProject: overallSummary.avgLogsPerProject,
          maxLogsPerProject: overallSummary.maxLogs,
          minLogsPerProject: overallSummary.minLogs,
        },
        recentProjects: recentProjects.map((project) => ({
          ...project,
          // Add computed fields
          daysSinceCreated: Math.floor(
            (Date.now() - new Date(project.createdAt ?? 0).getTime()) /
              (1000 * 60 * 60 * 24)
          ),
        })),
        topProjectsByLogs,
        popularTags,
        creationTrends: groupBy ? creationTrends : undefined,
        metadata: {
          userId: userId || null,
          filters: {
            includeInactive,
            dateRange: startDate || endDate ? { startDate, endDate } : null,
            groupBy,
          },
          generatedAt: new Date(),
          ...performanceMetrics,
        },
      };
    } catch (error: any) {
      // Enhanced error handling with context
      const errorContext = {
        userId,
        options,
        timestamp: new Date(),
      };

      // Log the error with context (implement your logging strategy)
      console.error("ProjectsSummary Error:", {
        error: error.message,
        context: errorContext,
      });

      // Re-throw custom errors or wrap generic ones
      if (
        error instanceof ProjectOperationError ||
        error instanceof ProjectNotFoundError
      ) {
        throw error;
      }

      throw new ProjectOperationError(
        `Failed to get projects summary: ${
          error.message || error
        } :: Context: ${errorContext}`
      );
    }
  }
}