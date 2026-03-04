import { UserPreferenceModel } from "../models/userPreference.model";
import { ProjectModel } from "../models/project.model";

export class UserPreferenceServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserPreferenceServiceError";
  }
}

export class UserPreferenceService {
  /**
   * Get user's favorite project IDs
   */
  static async getFavorites(userId: string) {
    try {
      const pref = await UserPreferenceModel.findOne({ userId });
      if (!pref) return [];
      return pref.favoriteProjects;
    } catch (error) {
      throw new UserPreferenceServiceError(`Failed to get favorites: ${error}`);
    }
  }

  /**
   * Get user's favorite projects with full project data
   */
  static async getFavoriteProjects(userId: string) {
    try {
      const pref = await UserPreferenceModel.findOne({ userId }).populate({
        path: "favoriteProjects",
        model: ProjectModel,
        select: "name description isActive logCount tags lastIngestedAt createdAt",
      });
      if (!pref) return [];
      return pref.favoriteProjects;
    } catch (error) {
      throw new UserPreferenceServiceError(`Failed to get favorite projects: ${error}`);
    }
  }

  /**
   * Add a project to user's favorites
   */
  static async addFavorite(userId: string, projectId: string) {
    try {
      // Verify project exists
      const project = await ProjectModel.findById(projectId);
      if (!project) {
        throw new UserPreferenceServiceError("Project not found");
      }

      await UserPreferenceModel.findOneAndUpdate(
        { userId },
        { $addToSet: { favoriteProjects: projectId } },
        { upsert: true, new: true }
      );

      return { message: "Project added to favorites" };
    } catch (error) {
      if (error instanceof UserPreferenceServiceError) throw error;
      throw new UserPreferenceServiceError(`Failed to add favorite: ${error}`);
    }
  }

  /**
   * Remove a project from user's favorites
   */
  static async removeFavorite(userId: string, projectId: string) {
    try {
      await UserPreferenceModel.findOneAndUpdate(
        { userId },
        { $pull: { favoriteProjects: projectId } }
      );
      return { message: "Project removed from favorites" };
    } catch (error) {
      throw new UserPreferenceServiceError(`Failed to remove favorite: ${error}`);
    }
  }

  /**
   * Check if a project is in user's favorites
   */
  static async isFavorite(userId: string, projectId: string): Promise<boolean> {
    try {
      const pref = await UserPreferenceModel.findOne({
        userId,
        favoriteProjects: projectId,
      });
      return !!pref;
    } catch (error) {
      throw new UserPreferenceServiceError(`Failed to check favorite: ${error}`);
    }
  }
}
