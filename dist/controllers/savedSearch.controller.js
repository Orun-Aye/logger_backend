"use strict";
// src/controllers/savedSearch.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.SavedSearchController = void 0;
const savedSearch_service_1 = require("../services/savedSearch.service");
class SavedSearchController {
    /**
     * Create a new saved search
     * POST /api/v1/projects/:projectId/saved-searches
     */
    static async createSavedSearch(req, res) {
        const { projectId } = req.params;
        const userId = req.userId;
        const data = req.body;
        const savedSearch = await savedSearch_service_1.SavedSearchService.createSavedSearch(projectId, userId, data);
        return res.status(201).json({
            status: "success",
            message: "Saved search created successfully",
            data: savedSearch,
        });
    }
    /**
     * Get all saved searches for a project
     * GET /api/v1/projects/:projectId/saved-searches
     */
    static async getSavedSearches(req, res) {
        const { projectId } = req.params;
        const userId = req.userId;
        const searches = await savedSearch_service_1.SavedSearchService.getSavedSearches(projectId, userId);
        return res.json({
            status: "success",
            data: searches,
            meta: {
                count: searches.length,
            },
        });
    }
    /**
     * Get a single saved search by ID
     * GET /api/v1/projects/:projectId/saved-searches/:searchId
     */
    static async getSavedSearchById(req, res) {
        const { projectId, searchId } = req.params;
        const userId = req.userId;
        const search = await savedSearch_service_1.SavedSearchService.getSavedSearchById(searchId, projectId, userId);
        return res.json({
            status: "success",
            data: search,
        });
    }
    /**
     * Get default saved search
     * GET /api/v1/projects/:projectId/saved-searches/default
     */
    static async getDefaultSavedSearch(req, res) {
        const { projectId } = req.params;
        const userId = req.userId;
        const search = await savedSearch_service_1.SavedSearchService.getDefaultSavedSearch(projectId, userId);
        if (!search) {
            return res.json({
                status: "success",
                data: null,
                message: "No default saved search found",
            });
        }
        return res.json({
            status: "success",
            data: search,
        });
    }
    /**
     * Update a saved search
     * PUT /api/v1/projects/:projectId/saved-searches/:searchId
     */
    static async updateSavedSearch(req, res) {
        const { projectId, searchId } = req.params;
        const userId = req.userId;
        const data = req.body;
        const updatedSearch = await savedSearch_service_1.SavedSearchService.updateSavedSearch(searchId, projectId, userId, data);
        return res.json({
            status: "success",
            message: "Saved search updated successfully",
            data: updatedSearch,
        });
    }
    /**
     * Delete a saved search
     * DELETE /api/v1/projects/:projectId/saved-searches/:searchId
     */
    static async deleteSavedSearch(req, res) {
        const { projectId, searchId } = req.params;
        const userId = req.userId;
        await savedSearch_service_1.SavedSearchService.deleteSavedSearch(searchId, projectId, userId);
        return res.json({
            status: "success",
            message: "Saved search deleted successfully",
        });
    }
}
exports.SavedSearchController = SavedSearchController;
