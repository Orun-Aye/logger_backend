// src/routes/savedSearch.routes.ts

import express from "express";
import { SavedSearchController } from "../controllers/savedSearch.controller";
import { asyncHandler } from "../middleware/errorHandler.middleware";
import { validate } from "../middleware/validation.middleware";
import {
  createSavedSearchSchema,
  updateSavedSearchSchema,
} from "../validators/savedSearch.validator";
import { verifyToken } from "../middleware/auth.middleware";
import { authorizeProjectAccess } from "../middleware/authorizeProjectAccess";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Note: Project authorization is handled by authorizeProjectAccess middleware

/**
 * @route   GET /api/v1/projects/:projectId/saved-searches/default
 * @desc    Get default saved search for a project
 * @access  Private
 */
router.get(
  "/:projectId/saved-searches/default",
  authorizeProjectAccess,
  asyncHandler(SavedSearchController.getDefaultSavedSearch)
);

/**
 * @route   POST /api/v1/projects/:projectId/saved-searches
 * @desc    Create a new saved search
 * @access  Private
 */
router.post(
  "/:projectId/saved-searches",
  authorizeProjectAccess,
  validate(createSavedSearchSchema, "body"),
  asyncHandler(SavedSearchController.createSavedSearch)
);

/**
 * @route   GET /api/v1/projects/:projectId/saved-searches
 * @desc    Get all saved searches for a project
 * @access  Private
 */
router.get(
  "/:projectId/saved-searches",
  authorizeProjectAccess,
  asyncHandler(SavedSearchController.getSavedSearches)
);

/**
 * @route   GET /api/v1/projects/:projectId/saved-searches/:searchId
 * @desc    Get a single saved search by ID
 * @access  Private
 */
router.get(
  "/:projectId/saved-searches/:searchId",
  authorizeProjectAccess,
  asyncHandler(SavedSearchController.getSavedSearchById)
);

/**
 * @route   PUT /api/v1/projects/:projectId/saved-searches/:searchId
 * @desc    Update a saved search
 * @access  Private
 */
router.put(
  "/:projectId/saved-searches/:searchId",
  authorizeProjectAccess,
  validate(updateSavedSearchSchema, "body"),
  asyncHandler(SavedSearchController.updateSavedSearch)
);

/**
 * @route   DELETE /api/v1/projects/:projectId/saved-searches/:searchId
 * @desc    Delete a saved search
 * @access  Private
 */
router.delete(
  "/:projectId/saved-searches/:searchId",
  authorizeProjectAccess,
  asyncHandler(SavedSearchController.deleteSavedSearch)
);

export default router;
