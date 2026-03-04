// src/services/savedSearch.service.ts

import { SavedSearchModel, ISavedSearch } from "../models/savedSearch.model";
import { CreateSavedSearchDTO, UpdateSavedSearchDTO } from "../dtos/savedSearch.dto";
import { NotFoundError, ConflictError } from "../errors";
import { Types } from "mongoose";

export class SavedSearchService {
  /**
   * Create a new saved search
   */
  static async createSavedSearch(
    projectId: string,
    userId: string,
    data: CreateSavedSearchDTO
  ): Promise<ISavedSearch> {
    // Check if a saved search with the same name already exists for this user/project
    const existing = await SavedSearchModel.findOne({
      projectId: new Types.ObjectId(projectId),
      userId: new Types.ObjectId(userId),
      name: data.name,
    });

    if (existing) {
      throw new ConflictError(
        `A saved search with the name "${data.name}" already exists for this project`
      );
    }

    const savedSearch = new SavedSearchModel({
      projectId: new Types.ObjectId(projectId),
      userId: new Types.ObjectId(userId),
      ...data,
    });

    await savedSearch.save();
    return savedSearch;
  }

  /**
   * Get all saved searches for a project (user's own + shared)
   */
  static async getSavedSearches(
    projectId: string,
    userId: string
  ): Promise<ISavedSearch[]> {
    const searches = await SavedSearchModel.find({
      projectId: new Types.ObjectId(projectId),
      $or: [{ userId: new Types.ObjectId(userId) }, { isShared: true }],
    }).sort({ isDefault: -1, createdAt: -1 });

    return searches;
  }

  /**
   * Get a single saved search by ID
   */
  static async getSavedSearchById(
    searchId: string,
    projectId: string,
    userId: string
  ): Promise<ISavedSearch> {
    const search = await SavedSearchModel.findOne({
      _id: new Types.ObjectId(searchId),
      projectId: new Types.ObjectId(projectId),
      $or: [{ userId: new Types.ObjectId(userId) }, { isShared: true }],
    });

    if (!search) {
      throw new NotFoundError("Saved search");
    }

    return search;
  }

  /**
   * Get default saved search for a user/project
   */
  static async getDefaultSavedSearch(
    projectId: string,
    userId: string
  ): Promise<ISavedSearch | null> {
    const search = await SavedSearchModel.findOne({
      projectId: new Types.ObjectId(projectId),
      userId: new Types.ObjectId(userId),
      isDefault: true,
    });

    return search;
  }

  /**
   * Update a saved search
   */
  static async updateSavedSearch(
    searchId: string,
    projectId: string,
    userId: string,
    data: UpdateSavedSearchDTO
  ): Promise<ISavedSearch> {
    // Find the search and verify ownership
    const search = await SavedSearchModel.findOne({
      _id: new Types.ObjectId(searchId),
      projectId: new Types.ObjectId(projectId),
      userId: new Types.ObjectId(userId), // Only owner can update
    });

    if (!search) {
      throw new NotFoundError("Saved search");
    }

    // If renaming, check for conflicts
    if (data.name && data.name !== search.name) {
      const existing = await SavedSearchModel.findOne({
        projectId: new Types.ObjectId(projectId),
        userId: new Types.ObjectId(userId),
        name: data.name,
        _id: { $ne: new Types.ObjectId(searchId) },
      });

      if (existing) {
        throw new ConflictError(
          `A saved search with the name "${data.name}" already exists`
        );
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
  static async deleteSavedSearch(
    searchId: string,
    projectId: string,
    userId: string
  ): Promise<void> {
    const result = await SavedSearchModel.deleteOne({
      _id: new Types.ObjectId(searchId),
      projectId: new Types.ObjectId(projectId),
      userId: new Types.ObjectId(userId), // Only owner can delete
    });

    if (result.deletedCount === 0) {
      throw new NotFoundError("Saved search");
    }
  }

  /**
   * Delete all saved searches for a project (when project is deleted)
   */
  static async deleteSavedSearchesByProject(projectId: string): Promise<number> {
    const result = await SavedSearchModel.deleteMany({
      projectId: new Types.ObjectId(projectId),
    });

    return result.deletedCount || 0;
  }

  /**
   * Delete all saved searches for a user
   */
  static async deleteSavedSearchesByUser(userId: string): Promise<number> {
    const result = await SavedSearchModel.deleteMany({
      userId: new Types.ObjectId(userId),
    });

    return result.deletedCount || 0;
  }
}
