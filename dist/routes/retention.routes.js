"use strict";
// src/routes/retention.routes.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const retention_controller_1 = require("../controllers/retention.controller");
const errorHandler_middleware_1 = require("../middleware/errorHandler.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const authorizeProjectAccess_1 = require("../middleware/authorizeProjectAccess");
const router = express_1.default.Router();
// All routes require authentication
router.use(auth_middleware_1.verifyToken);
/**
 * @route   GET /api/v1/retention/:projectId/preview
 * @desc    Preview retention policy impact
 * @access  Private (project access required)
 * @query   retentionDays - Number of days to retain logs
 */
router.get("/:projectId/preview", authorizeProjectAccess_1.authorizeProjectAccess, (0, errorHandler_middleware_1.asyncHandler)(retention_controller_1.RetentionController.previewRetention));
/**
 * @route   POST /api/v1/retention/:projectId/apply
 * @desc    Apply retention policy to a project
 * @access  Private (project access required)
 * @body    { retentionDays: number, samplingRate?: number }
 */
router.post("/:projectId/apply", authorizeProjectAccess_1.authorizeProjectAccess, (0, errorHandler_middleware_1.asyncHandler)(retention_controller_1.RetentionController.applyRetention));
/**
 * @route   POST /api/v1/retention/:projectId/sample
 * @desc    Apply sampling to project logs
 * @access  Private (project access required)
 * @body    { samplingRate: number, startDate?: string, endDate?: string }
 */
router.post("/:projectId/sample", authorizeProjectAccess_1.authorizeProjectAccess, (0, errorHandler_middleware_1.asyncHandler)(retention_controller_1.RetentionController.applySampling));
/**
 * @route   POST /api/v1/retention/run-all
 * @desc    Run retention for all projects (admin only)
 * @access  Private (admin only - TODO: add admin middleware)
 * @body    { defaultRetentionDays?: number }
 */
router.post("/run-all", 
// TODO: Add admin authorization middleware
(0, errorHandler_middleware_1.asyncHandler)(retention_controller_1.RetentionController.runAllProjectRetention));
exports.default = router;
