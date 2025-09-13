"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const log_controller_1 = require("../controllers/log.controller");
const auth_middleware_1 = require("../middleware/auth.middleware"); // Assuming verifyToken exists
const router = (0, express_1.Router)();
// --- Log Ingestion (typically requires API Key authentication) ---
// Create a new log entry for a specific project
router.post('/:projectId/logs', auth_middleware_1.authenticateApiKey, log_controller_1.LogController.createLog);
// --- Log Management and Analytics (typically requires user authentication) ---
// Get log summary for a project
router.get('/:projectId/logs/summary', auth_middleware_1.verifyToken, log_controller_1.LogController.getLogsSummary);
// Get log trends (volume over time) for a project
router.get('/:projectId/logs/trends', auth_middleware_1.verifyToken, log_controller_1.LogController.getLogTrends);
// Get distinct values for a specific field within a project's logs (e.g., /levels, /services)
router.get('/:projectId/logs/distinct-values/:field', auth_middleware_1.verifyToken, log_controller_1.LogController.getDistinctValues);
// Get unique error messages for a project
router.get('/:projectId/logs/unique-errors', auth_middleware_1.verifyToken, log_controller_1.LogController.getUniqueErrorMessages);
// Get a specific log by ID (should be after more specific routes like /summary, /trends)
router.get('/:projectId/logs/:logId', auth_middleware_1.verifyToken, log_controller_1.LogController.getLogById);
// Get all logs for a specific project with filters and pagination
router.get('/:projectId/logs', auth_middleware_1.verifyToken, log_controller_1.LogController.getAllLogs);
// Delete logs for a specific project based on filters (bulk delete)
// This route should be placed carefully to avoid conflict with GET /:projectId/logs
// and typically uses DELETE method for idempotent deletion.
router.delete('/:projectId/logs', auth_middleware_1.verifyToken, log_controller_1.LogController.deleteLogs);
exports.default = router;
