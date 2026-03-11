"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserPreferenceService = exports.UserPreferenceServiceError = void 0;
const userPreference_model_1 = require("../models/userPreference.model");
const project_model_1 = require("../models/project.model");
class UserPreferenceServiceError extends Error {
    constructor(message) {
        super(message);
        this.name = "UserPreferenceServiceError";
    }
}
exports.UserPreferenceServiceError = UserPreferenceServiceError;
class UserPreferenceService {
    /**
     * Get user's favorite project IDs
     */
    static async getFavorites(userId) {
        try {
            const pref = await userPreference_model_1.UserPreferenceModel.findOne({ userId });
            if (!pref)
                return [];
            return pref.favoriteProjects;
        }
        catch (error) {
            throw new UserPreferenceServiceError(`Failed to get favorites: ${error}`);
        }
    }
    /**
     * Get user's favorite projects with full project data
     */
    static async getFavoriteProjects(userId) {
        try {
            const pref = await userPreference_model_1.UserPreferenceModel.findOne({ userId }).populate({
                path: "favoriteProjects",
                model: project_model_1.ProjectModel,
                select: "name description isActive logCount tags lastIngestedAt createdAt",
            });
            if (!pref)
                return [];
            return pref.favoriteProjects;
        }
        catch (error) {
            throw new UserPreferenceServiceError(`Failed to get favorite projects: ${error}`);
        }
    }
    /**
     * Add a project to user's favorites
     */
    static async addFavorite(userId, projectId) {
        try {
            // Verify project exists
            const project = await project_model_1.ProjectModel.findById(projectId);
            if (!project) {
                throw new UserPreferenceServiceError("Project not found");
            }
            await userPreference_model_1.UserPreferenceModel.findOneAndUpdate({ userId }, { $addToSet: { favoriteProjects: projectId } }, { upsert: true, new: true });
            return { message: "Project added to favorites" };
        }
        catch (error) {
            if (error instanceof UserPreferenceServiceError)
                throw error;
            throw new UserPreferenceServiceError(`Failed to add favorite: ${error}`);
        }
    }
    /**
     * Remove a project from user's favorites
     */
    static async removeFavorite(userId, projectId) {
        try {
            await userPreference_model_1.UserPreferenceModel.findOneAndUpdate({ userId }, { $pull: { favoriteProjects: projectId } });
            return { message: "Project removed from favorites" };
        }
        catch (error) {
            throw new UserPreferenceServiceError(`Failed to remove favorite: ${error}`);
        }
    }
    /**
     * Check if a project is in user's favorites
     */
    static async isFavorite(userId, projectId) {
        try {
            const pref = await userPreference_model_1.UserPreferenceModel.findOne({
                userId,
                favoriteProjects: projectId,
            });
            return !!pref;
        }
        catch (error) {
            throw new UserPreferenceServiceError(`Failed to check favorite: ${error}`);
        }
    }
}
exports.UserPreferenceService = UserPreferenceService;
