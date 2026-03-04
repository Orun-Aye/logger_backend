"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserPreferenceController = void 0;
const userPreference_service_1 = require("../services/userPreference.service");
class UserPreferenceController {
    static async getFavorites(req, res) {
        try {
            const data = await userPreference_service_1.UserPreferenceService.getFavoriteProjects(req.userId);
            return res.status(200).json({ status: "success", data });
        }
        catch (error) {
            return res.status(500).json({ status: "error", message: error.message });
        }
    }
    static async addFavorite(req, res) {
        try {
            const { projectId } = req.body;
            const data = await userPreference_service_1.UserPreferenceService.addFavorite(req.userId, projectId);
            return res.status(200).json({ status: "success", ...data });
        }
        catch (error) {
            if (error.message === "Project not found") {
                return res.status(404).json({ status: "error", message: error.message });
            }
            return res.status(500).json({ status: "error", message: error.message });
        }
    }
    static async removeFavorite(req, res) {
        try {
            const { projectId } = req.body;
            const data = await userPreference_service_1.UserPreferenceService.removeFavorite(req.userId, projectId);
            return res.status(200).json({ status: "success", ...data });
        }
        catch (error) {
            return res.status(500).json({ status: "error", message: error.message });
        }
    }
    static async checkFavorite(req, res) {
        try {
            const { projectId } = req.params;
            const isFavorite = await userPreference_service_1.UserPreferenceService.isFavorite(req.userId, projectId);
            return res.status(200).json({ status: "success", data: { isFavorite } });
        }
        catch (error) {
            return res.status(500).json({ status: "error", message: error.message });
        }
    }
}
exports.UserPreferenceController = UserPreferenceController;
