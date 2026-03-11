"use strict";
// src/routes/savedSearch.routes.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const savedSearch_controller_1 = require("../controllers/savedSearch.controller");
const errorHandler_middleware_1 = require("../middleware/errorHandler.middleware");
const validation_middleware_1 = require("../middleware/validation.middleware");
const savedSearch_validator_1 = require("../validators/savedSearch.validator");
const auth_middleware_1 = require("../middleware/auth.middleware");
const authorizeProjectAccess_1 = require("../middleware/authorizeProjectAccess");
const router = express_1.default.Router();
// All routes require authentication
router.use(auth_middleware_1.verifyToken);
// Note: Project authorization is handled by authorizeProjectAccess middleware
/**
 * @route   GET /api/v1/projects/:projectId/saved-searches/default
 * @desc    Get default saved search for a project
 * @access  Private
 */
router.get("/:projectId/saved-searches/default", authorizeProjectAccess_1.authorizeProjectAccess, (0, errorHandler_middleware_1.asyncHandler)(savedSearch_controller_1.SavedSearchController.getDefaultSavedSearch));
/**
 * @route   POST /api/v1/projects/:projectId/saved-searches
 * @desc    Create a new saved search
 * @access  Private
 */
router.post("/:projectId/saved-searches", authorizeProjectAccess_1.authorizeProjectAccess, (0, validation_middleware_1.validate)(savedSearch_validator_1.createSavedSearchSchema, "body"), (0, errorHandler_middleware_1.asyncHandler)(savedSearch_controller_1.SavedSearchController.createSavedSearch));
/**
 * @route   GET /api/v1/projects/:projectId/saved-searches
 * @desc    Get all saved searches for a project
 * @access  Private
 */
router.get("/:projectId/saved-searches", authorizeProjectAccess_1.authorizeProjectAccess, (0, errorHandler_middleware_1.asyncHandler)(savedSearch_controller_1.SavedSearchController.getSavedSearches));
/**
 * @route   GET /api/v1/projects/:projectId/saved-searches/:searchId
 * @desc    Get a single saved search by ID
 * @access  Private
 */
router.get("/:projectId/saved-searches/:searchId", authorizeProjectAccess_1.authorizeProjectAccess, (0, errorHandler_middleware_1.asyncHandler)(savedSearch_controller_1.SavedSearchController.getSavedSearchById));
/**
 * @route   PUT /api/v1/projects/:projectId/saved-searches/:searchId
 * @desc    Update a saved search
 * @access  Private
 */
router.put("/:projectId/saved-searches/:searchId", authorizeProjectAccess_1.authorizeProjectAccess, (0, validation_middleware_1.validate)(savedSearch_validator_1.updateSavedSearchSchema, "body"), (0, errorHandler_middleware_1.asyncHandler)(savedSearch_controller_1.SavedSearchController.updateSavedSearch));
/**
 * @route   DELETE /api/v1/projects/:projectId/saved-searches/:searchId
 * @desc    Delete a saved search
 * @access  Private
 */
router.delete("/:projectId/saved-searches/:searchId", authorizeProjectAccess_1.authorizeProjectAccess, (0, errorHandler_middleware_1.asyncHandler)(savedSearch_controller_1.SavedSearchController.deleteSavedSearch));
exports.default = router;
