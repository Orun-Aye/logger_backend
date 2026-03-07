import mongoose from "mongoose";
import { TeamModel, ITeam } from "../models/team.model";
import { OrganizationModel } from "../models/organization.model";
import { UserModel } from "../models/user.model";
import { ProjectModel } from "../models/project.model";

// ---------- Custom Errors ----------

export class TeamNotFoundError extends Error {
  constructor(message = "Team not found") {
    super(message);
    this.name = "TeamNotFoundError";
  }
}

export class TeamValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TeamValidationError";
  }
}

// ---------- Service ----------

export class TeamService {
  /**
   * Create a team within an organization.
   */
  static async createTeam(orgId: string, name: string): Promise<ITeam> {
    try {
      if (!mongoose.Types.ObjectId.isValid(orgId)) {
        throw new TeamValidationError("Invalid organization ID");
      }
      if (!name || typeof name !== "string") {
        throw new TeamValidationError("Team name is required");
      }

      // Verify org exists
      const org = await OrganizationModel.findById(orgId).lean();
      if (!org) {
        throw new TeamValidationError("Organization not found");
      }

      const team = new TeamModel({
        organizationId: new mongoose.Types.ObjectId(orgId),
        name,
        members: [],
        projectAccess: [],
      });

      const saved = await team.save();
      return saved;
    } catch (error) {
      if (error instanceof TeamValidationError) {
        throw error;
      }
      // Handle MongoDB duplicate key error (org + name unique)
      if ((error as any).code === 11000) {
        throw new TeamValidationError(
          "A team with this name already exists in the organization"
        );
      }
      throw new Error(`Failed to create team: ${error}`);
    }
  }

  /**
   * Get all teams in an organization.
   */
  static async getTeams(orgId: string): Promise<ITeam[]> {
    try {
      if (!mongoose.Types.ObjectId.isValid(orgId)) {
        throw new TeamValidationError("Invalid organization ID");
      }

      const teams = await TeamModel.find({
        organizationId: new mongoose.Types.ObjectId(orgId),
      })
        .populate("members.user", "email firstName lastName avatarUrl")
        .populate("projectAccess.project", "name")
        .sort({ createdAt: -1 })
        .lean<ITeam[]>();

      return teams;
    } catch (error) {
      if (error instanceof TeamValidationError) {
        throw error;
      }
      throw new Error(`Failed to get teams: ${error}`);
    }
  }

  /**
   * Get a single team by ID.
   */
  static async getTeam(teamId: string): Promise<ITeam> {
    try {
      if (!mongoose.Types.ObjectId.isValid(teamId)) {
        throw new TeamValidationError("Invalid team ID");
      }

      const team = await TeamModel.findById(teamId)
        .populate("members.user", "email firstName lastName avatarUrl")
        .populate("projectAccess.project", "name")
        .lean<ITeam>();

      if (!team) {
        throw new TeamNotFoundError();
      }

      return team;
    } catch (error) {
      if (
        error instanceof TeamNotFoundError ||
        error instanceof TeamValidationError
      ) {
        throw error;
      }
      throw new Error(`Failed to get team: ${error}`);
    }
  }

  /**
   * Update team name.
   */
  static async updateTeam(
    teamId: string,
    updates: { name?: string }
  ): Promise<ITeam> {
    try {
      if (!mongoose.Types.ObjectId.isValid(teamId)) {
        throw new TeamValidationError("Invalid team ID");
      }

      const team = await TeamModel.findByIdAndUpdate(
        teamId,
        { $set: updates },
        { new: true, runValidators: true }
      )
        .populate("members.user", "email firstName lastName avatarUrl")
        .populate("projectAccess.project", "name")
        .lean<ITeam>();

      if (!team) {
        throw new TeamNotFoundError();
      }

      return team;
    } catch (error) {
      if (
        error instanceof TeamNotFoundError ||
        error instanceof TeamValidationError
      ) {
        throw error;
      }
      if ((error as any).code === 11000) {
        throw new TeamValidationError(
          "A team with this name already exists in the organization"
        );
      }
      throw new Error(`Failed to update team: ${error}`);
    }
  }

  /**
   * Delete a team.
   */
  static async deleteTeam(teamId: string): Promise<void> {
    try {
      if (!mongoose.Types.ObjectId.isValid(teamId)) {
        throw new TeamValidationError("Invalid team ID");
      }

      const team = await TeamModel.findByIdAndDelete(teamId).lean();
      if (!team) {
        throw new TeamNotFoundError();
      }
    } catch (error) {
      if (
        error instanceof TeamNotFoundError ||
        error instanceof TeamValidationError
      ) {
        throw error;
      }
      throw new Error(`Failed to delete team: ${error}`);
    }
  }

  /**
   * Add a member to a team.
   */
  static async addMember(
    teamId: string,
    userId: string,
    role: "lead" | "member" = "member"
  ): Promise<ITeam> {
    try {
      if (!mongoose.Types.ObjectId.isValid(teamId)) {
        throw new TeamValidationError("Invalid team ID");
      }
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new TeamValidationError("Invalid user ID");
      }

      const team = await TeamModel.findById(teamId);
      if (!team) {
        throw new TeamNotFoundError();
      }

      // Check if user is already in the team
      const existingMember = team.members.find(
        (m) => m.user.toString() === userId
      );
      if (existingMember) {
        throw new TeamValidationError("User is already a member of this team");
      }

      // Verify the user exists
      const user = await UserModel.findById(userId).lean();
      if (!user) {
        throw new TeamValidationError("User not found");
      }

      // Verify the user is a member of the parent org
      const org = await OrganizationModel.findOne({
        _id: team.organizationId,
        "members.user": new mongoose.Types.ObjectId(userId),
      }).lean();
      if (!org) {
        throw new TeamValidationError(
          "User must be a member of the organization to join a team"
        );
      }

      team.members.push({
        user: new mongoose.Types.ObjectId(userId),
        role,
      });

      await team.save();

      return await this.getTeam(teamId);
    } catch (error) {
      if (
        error instanceof TeamNotFoundError ||
        error instanceof TeamValidationError
      ) {
        throw error;
      }
      throw new Error(`Failed to add team member: ${error}`);
    }
  }

  /**
   * Remove a member from a team.
   */
  static async removeMember(teamId: string, userId: string): Promise<ITeam> {
    try {
      if (!mongoose.Types.ObjectId.isValid(teamId)) {
        throw new TeamValidationError("Invalid team ID");
      }
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new TeamValidationError("Invalid user ID");
      }

      const team = await TeamModel.findById(teamId);
      if (!team) {
        throw new TeamNotFoundError();
      }

      const memberIndex = team.members.findIndex(
        (m) => m.user.toString() === userId
      );
      if (memberIndex === -1) {
        throw new TeamValidationError("User is not a member of this team");
      }

      team.members.splice(memberIndex, 1);
      await team.save();

      return await this.getTeam(teamId);
    } catch (error) {
      if (
        error instanceof TeamNotFoundError ||
        error instanceof TeamValidationError
      ) {
        throw error;
      }
      throw new Error(`Failed to remove team member: ${error}`);
    }
  }

  /**
   * Set (add or update) project access for a team.
   */
  static async setProjectAccess(
    teamId: string,
    projectId: string,
    permission: "read" | "write" | "admin"
  ): Promise<ITeam> {
    try {
      if (!mongoose.Types.ObjectId.isValid(teamId)) {
        throw new TeamValidationError("Invalid team ID");
      }
      if (!mongoose.Types.ObjectId.isValid(projectId)) {
        throw new TeamValidationError("Invalid project ID");
      }

      const team = await TeamModel.findById(teamId);
      if (!team) {
        throw new TeamNotFoundError();
      }

      // Verify the project exists
      const project = await ProjectModel.findById(projectId).lean();
      if (!project) {
        throw new TeamValidationError("Project not found");
      }

      // Check if project access already exists — update it
      const existingAccess = team.projectAccess.find(
        (pa) => pa.project.toString() === projectId
      );
      if (existingAccess) {
        existingAccess.permission = permission;
      } else {
        team.projectAccess.push({
          project: new mongoose.Types.ObjectId(projectId),
          permission,
        });
      }

      await team.save();

      return await this.getTeam(teamId);
    } catch (error) {
      if (
        error instanceof TeamNotFoundError ||
        error instanceof TeamValidationError
      ) {
        throw error;
      }
      throw new Error(`Failed to set project access: ${error}`);
    }
  }
}
