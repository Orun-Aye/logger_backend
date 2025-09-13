"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const project_controller_1 = require("../controllers/project.controller");
const auth_middleware_1 = require("../middleware/auth.middleware"); // Assuming this middleware exists and sets req.userId
const router = (0, express_1.Router)();
// --- Public / Unauthenticated Routes ---
// Health Check (can be public for monitoring)
router.get("/health", project_controller_1.ProjectController.healthCheck);
// Get a project by API key (intended for external services, typically does not require user token)
// The controller expects API key in 'x-api-key' header or 'apiKey' query param,
// so a specific path param for API key is not needed here.
router.get("/by-api-key", project_controller_1.ProjectController.getProjectByApiKey);
// --- Authenticated Routes (Require verifyToken middleware) ---
// Project Summary and Analytics
router.get("/summary", auth_middleware_1.verifyToken, project_controller_1.ProjectController.getProjectsSummary);
router.get("/analytics", auth_middleware_1.verifyToken, project_controller_1.ProjectController.getAnalytics);
// Core Project Management (CRUD)
router.post("/", auth_middleware_1.verifyToken, project_controller_1.ProjectController.create); // Create a new project
// Specific GET routes should come before general :id GET route
router.get("/", auth_middleware_1.verifyToken, project_controller_1.ProjectController.getByUser); // Get projects associated with a specific user ID
router.get("/:id/stats", auth_middleware_1.verifyToken, project_controller_1.ProjectController.getProjectStats); // Get project usage statistics (log count, etc.)
router.get("/:id/team-members", auth_middleware_1.verifyToken, project_controller_1.ProjectController.getTeamMembers); // Get team members for a specific project
// General GET by ID (should be after more specific GETs)
router.get("/:id", auth_middleware_1.verifyToken, project_controller_1.ProjectController.getById); // Get a specific project by ID
// Project Lifecycle Management
router.put("/:id/restore", auth_middleware_1.verifyToken, project_controller_1.ProjectController.restoreProject); // Restore an archived project
router.put("/:id/archive", auth_middleware_1.verifyToken, project_controller_1.ProjectController.archiveProject); // Archive a project
router.post("/:sourceProjectId/duplicate", auth_middleware_1.verifyToken, project_controller_1.ProjectController.duplicateProject); // Duplicate a project
router.put("/:projectId/transfer-ownership", auth_middleware_1.verifyToken, project_controller_1.ProjectController.transferOwnership); // Transfer project ownership
// API Key Management
router.post("/:id/regenerate-api-key", auth_middleware_1.verifyToken, project_controller_1.ProjectController.regenerateApiKey); // Regenerate API key for a project
// Tag Management
router.post("/:projectId/tags", auth_middleware_1.verifyToken, project_controller_1.ProjectController.addTags); // Add tags to a project
router.delete("/:projectId/tags", auth_middleware_1.verifyToken, project_controller_1.ProjectController.removeTags); // Remove tags from a project
// Rate Limit Configuration
router.put("/:projectId/rate-limit", auth_middleware_1.verifyToken, project_controller_1.ProjectController.updateRateLimit); // Update rate limit configuration
// Log Count Synchronization (Admin/Maintenance Endpoints)
router.post("/:projectId/sync-log-count", auth_middleware_1.verifyToken, project_controller_1.ProjectController.syncLogCount); // Sync log count for a specific project
router.post("/sync-all-log-counts", auth_middleware_1.verifyToken, project_controller_1.ProjectController.syncAllLogCounts); // Sync all project log counts
router.post("/:projectId/increment-log-count", auth_middleware_1.verifyToken, project_controller_1.ProjectController.incrementLogCount); // Increment log count for a project
// Team Member Management
router.post("/:projectId/team-members", auth_middleware_1.verifyToken, project_controller_1.ProjectController.addTeamMember); // Add a team member to a project
router.delete("/:projectId/team-members", auth_middleware_1.verifyToken, project_controller_1.ProjectController.removeTeamMember); // Remove a team member from a project
router.put("/:projectId/team-members/role", auth_middleware_1.verifyToken, project_controller_1.ProjectController.updateTeamMemberRole); // Update a team member's role
// Integration Settings
router.put("/:projectId/integration-settings", auth_middleware_1.verifyToken, project_controller_1.ProjectController.updateIntegrationSettings); // Update integration settings for a project
// Update and Delete Operations
router.put("/:id", auth_middleware_1.verifyToken, project_controller_1.ProjectController.updateById); // Update a project by ID
// Bulk Operations (must come before single delete if using same path)
router.delete("/", auth_middleware_1.verifyToken, project_controller_1.ProjectController.bulkDelete); // Bulk Delete projects (accepts array of IDs in body)
router.put("/bulk-update", auth_middleware_1.verifyToken, project_controller_1.ProjectController.bulkUpdate); // Bulk Update projects
// General Delete by ID (should be after bulk delete to avoid conflict)
router.delete("/:id", auth_middleware_1.verifyToken, project_controller_1.ProjectController.delete); // Delete a project by ID (supports soft/hard delete via query param)
// Get all projects (general catch-all for '/') - usually placed towards the end
router.get("/all", auth_middleware_1.verifyToken, project_controller_1.ProjectController.getAll);
exports.default = router;
