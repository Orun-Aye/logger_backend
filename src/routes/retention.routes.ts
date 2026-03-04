// src/routes/retention.routes.ts

import express from "express";
import { RetentionController } from "../controllers/retention.controller";
import { asyncHandler } from "../middleware/errorHandler.middleware";
import { verifyToken } from "../middleware/auth.middleware";
import { authorizeProjectAccess } from "../middleware/authorizeProjectAccess";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

/**
 * @route   GET /api/v1/retention/:projectId/preview
 * @desc    Preview retention policy impact
 * @access  Private (project access required)
 * @query   retentionDays - Number of days to retain logs
 */
router.get(
  "/:projectId/preview",
  authorizeProjectAccess,
  asyncHandler(RetentionController.previewRetention)
);

/**
 * @route   POST /api/v1/retention/:projectId/apply
 * @desc    Apply retention policy to a project
 * @access  Private (project access required)
 * @body    { retentionDays: number, samplingRate?: number }
 */
router.post(
  "/:projectId/apply",
  authorizeProjectAccess,
  asyncHandler(RetentionController.applyRetention)
);

/**
 * @route   POST /api/v1/retention/:projectId/sample
 * @desc    Apply sampling to project logs
 * @access  Private (project access required)
 * @body    { samplingRate: number, startDate?: string, endDate?: string }
 */
router.post(
  "/:projectId/sample",
  authorizeProjectAccess,
  asyncHandler(RetentionController.applySampling)
);

/**
 * @route   POST /api/v1/retention/run-all
 * @desc    Run retention for all projects (admin only)
 * @access  Private (admin only - TODO: add admin middleware)
 * @body    { defaultRetentionDays?: number }
 */
router.post(
  "/run-all",
  // TODO: Add admin authorization middleware
  asyncHandler(RetentionController.runAllProjectRetention)
);

export default router;
