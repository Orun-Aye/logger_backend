// src/controllers/savedSearch.controller.ts

import { Request, Response } from "express";
import { SavedSearchService } from "../services/savedSearch.service";
import { CreateSavedSearchDTO, UpdateSavedSearchDTO } from "../dtos/savedSearch.dto";

export class SavedSearchController {
  /**
   * Create a new saved search
   * POST /api/v1/projects/:projectId/saved-searches
   */
  static async createSavedSearch(req: Request, res: Response) {
    const { projectId } = req.params;
    const userId = req.userId!;
    const data: CreateSavedSearchDTO = req.body;

    const savedSearch = await SavedSearchService.createSavedSearch(
      projectId,
      userId,
      data
    );

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
  static async getSavedSearches(req: Request, res: Response) {
    const { projectId } = req.params;
    const userId = req.userId!;

    const searches = await SavedSearchService.getSavedSearches(projectId, userId);

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
  static async getSavedSearchById(req: Request, res: Response) {
    const { projectId, searchId } = req.params;
    const userId = req.userId!;

    const search = await SavedSearchService.getSavedSearchById(
      searchId,
      projectId,
      userId
    );

    return res.json({
      status: "success",
      data: search,
    });
  }

  /**
   * Get default saved search
   * GET /api/v1/projects/:projectId/saved-searches/default
   */
  static async getDefaultSavedSearch(req: Request, res: Response) {
    const { projectId } = req.params;
    const userId = req.userId!;

    const search = await SavedSearchService.getDefaultSavedSearch(projectId, userId);

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
  static async updateSavedSearch(req: Request, res: Response) {
    const { projectId, searchId } = req.params;
    const userId = req.userId!;
    const data: UpdateSavedSearchDTO = req.body;

    const updatedSearch = await SavedSearchService.updateSavedSearch(
      searchId,
      projectId,
      userId,
      data
    );

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
  static async deleteSavedSearch(req: Request, res: Response) {
    const { projectId, searchId } = req.params;
    const userId = req.userId!;

    await SavedSearchService.deleteSavedSearch(searchId, projectId, userId);

    return res.json({
      status: "success",
      message: "Saved search deleted successfully",
    });
  }
}
