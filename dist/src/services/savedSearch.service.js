"use strict";
// src/services/savedSearch.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.SavedSearchService = void 0;
const savedSearch_model_1 = require("../models/savedSearch.model");
const errors_1 = require("../errors");
const mongoose_1 = require("mongoose");
class SavedSearchService {
    /**
     * Create a new saved search
     */
    static async createSavedSearch(projectId, userId, data) {
        // Check if a saved search with the same name already exists for this user/project
        const existing = await savedSearch_model_1.SavedSearchModel.findOne({
            projectId: new mongoose_1.Types.ObjectId(projectId),
            userId: new mongoose_1.Types.ObjectId(userId),
            name: data.name,
        });
        if (existing) {
            throw new errors_1.ConflictError(`A saved search with the name "${data.name}" already exists for this project`);
        }
        const savedSearch = new savedSearch_model_1.SavedSearchModel({
            projectId: new mongoose_1.Types.ObjectId(projectId),
            userId: new mongoose_1.Types.ObjectId(userId),
            ...data,
        });
        await savedSearch.save();
        return savedSearch;
    }
    /**
     * Get all saved searches for a project (user's own + shared)
     */
    static async getSavedSearches(projectId, userId) {
        const searches = await savedSearch_model_1.SavedSearchModel.find({
            projectId: new mongoose_1.Types.ObjectId(projectId),
            $or: [{ userId: new mongoose_1.Types.ObjectId(userId) }, { isShared: true }],
        }).sort({ isDefault: -1, createdAt: -1 });
        return searches;
    }
    /**
     * Get a single saved search by ID
     */
    static async getSavedSearchById(searchId, projectId, userId) {
        const search = await savedSearch_model_1.SavedSearchModel.findOne({
            _id: new mongoose_1.Types.ObjectId(searchId),
            projectId: new mongoose_1.Types.ObjectId(projectId),
            $or: [{ userId: new mongoose_1.Types.ObjectId(userId) }, { isShared: true }],
        });
        if (!search) {
            throw new errors_1.NotFoundError("Saved search");
        }
        return search;
    }
    /**
     * Get default saved search for a user/project
     */
    static async getDefaultSavedSearch(projectId, userId) {
        const search = await savedSearch_model_1.SavedSearchModel.findOne({
            projectId: new mongoose_1.Types.ObjectId(projectId),
            userId: new mongoose_1.Types.ObjectId(userId),
            isDefault: true,
        });
        return search;
    }
    /**
     * Update a saved search
     */
    static async updateSavedSearch(searchId, projectId, userId, data) {
        // Find the search and verify ownership
        const search = await savedSearch_model_1.SavedSearchModel.findOne({
            _id: new mongoose_1.Types.ObjectId(searchId),
            projectId: new mongoose_1.Types.ObjectId(projectId),
            userId: new mongoose_1.Types.ObjectId(userId), // Only owner can update
        });
        if (!search) {
            throw new errors_1.NotFoundError("Saved search");
        }
        // If renaming, check for conflicts
        if (data.name && data.name !== search.name) {
            const existing = await savedSearch_model_1.SavedSearchModel.findOne({
                projectId: new mongoose_1.Types.ObjectId(projectId),
                userId: new mongoose_1.Types.ObjectId(userId),
                name: data.name,
                _id: { $ne: new mongoose_1.Types.ObjectId(searchId) },
            });
            if (existing) {
                throw new errors_1.ConflictError(`A saved search with the name "${data.name}" already exists`);
            }
        }
        // Update fields
        Object.assign(search, data);
        await search.save();
        return search;
    }
    /**
     * Delete a saved search
     */
    static async deleteSavedSearch(searchId, projectId, userId) {
        const result = await savedSearch_model_1.SavedSearchModel.deleteOne({
            _id: new mongoose_1.Types.ObjectId(searchId),
            projectId: new mongoose_1.Types.ObjectId(projectId),
            userId: new mongoose_1.Types.ObjectId(userId), // Only owner can delete
        });
        if (result.deletedCount === 0) {
            throw new errors_1.NotFoundError("Saved search");
        }
    }
    /**
     * Delete all saved searches for a project (when project is deleted)
     */
    static async deleteSavedSearchesByProject(projectId) {
        const result = await savedSearch_model_1.SavedSearchModel.deleteMany({
            projectId: new mongoose_1.Types.ObjectId(projectId),
        });
        return result.deletedCount || 0;
    }
    /**
     * Delete all saved searches for a user
     */
    static async deleteSavedSearchesByUser(userId) {
        const result = await savedSearch_model_1.SavedSearchModel.deleteMany({
            userId: new mongoose_1.Types.ObjectId(userId),
        });
        return result.deletedCount || 0;
    }
}
exports.SavedSearchService = SavedSearchService;
