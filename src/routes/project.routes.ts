import { Router } from "express";
import { ProjectController } from "../controllers/project.controller";
import { verifyToken } from "../middleware/auth.middleware"; // Assuming this middleware exists and sets req.userId

const router = Router();

// --- Public / Unauthenticated Routes ---
// Health Check (can be public for monitoring)
router.get("/health", ProjectController.healthCheck);

// Get a project by API key (intended for external services, typically does not require user token)
// The controller expects API key in 'x-api-key' header or 'apiKey' query param,
// so a specific path param for API key is not needed here.
router.get("/by-api-key", ProjectController.getProjectByApiKey);


// --- Authenticated Routes (Require verifyToken middleware) ---

// Project Summary and Analytics
router.get("/summary", verifyToken, ProjectController.getProjectsSummary);
router.get("/analytics", verifyToken, ProjectController.getAnalytics);


// Core Project Management (CRUD)
router.post("/", verifyToken, ProjectController.create); // Create a new project

// Specific GET routes should come before general :id GET route
router.get("/user/:id", verifyToken, ProjectController.getByUser); // Get projects associated with a specific user ID
router.get("/:id/stats", verifyToken, ProjectController.getProjectStats); // Get project usage statistics (log count, etc.)
router.get("/:id/team-members", verifyToken, ProjectController.getTeamMembers); // Get team members for a specific project

// General GET by ID (should be after more specific GETs)
router.get("/:id", verifyToken, ProjectController.getById); // Get a specific project by ID


// Project Lifecycle Management
router.put("/:id/restore", verifyToken, ProjectController.restoreProject); // Restore an archived project
router.put("/:id/archive", verifyToken, ProjectController.archiveProject); // Archive a project
router.post("/:sourceProjectId/duplicate", verifyToken, ProjectController.duplicateProject); // Duplicate a project
router.put("/:projectId/transfer-ownership", verifyToken, ProjectController.transferOwnership); // Transfer project ownership


// API Key Management
router.post("/:id/regenerate-api-key", verifyToken, ProjectController.regenerateApiKey); // Regenerate API key for a project


// Tag Management
router.post("/:projectId/tags", verifyToken, ProjectController.addTags); // Add tags to a project
router.delete("/:projectId/tags", verifyToken, ProjectController.removeTags); // Remove tags from a project


// Rate Limit Configuration
router.put("/:projectId/rate-limit", verifyToken, ProjectController.updateRateLimit); // Update rate limit configuration


// Log Count Synchronization (Admin/Maintenance Endpoints)
router.post("/:projectId/sync-log-count", verifyToken, ProjectController.syncLogCount); // Sync log count for a specific project
router.post("/sync-all-log-counts", verifyToken, ProjectController.syncAllLogCounts); // Sync all project log counts
router.post("/:projectId/increment-log-count", verifyToken, ProjectController.incrementLogCount); // Increment log count for a project


// Team Member Management
router.post("/:projectId/team-members", verifyToken, ProjectController.addTeamMember); // Add a team member to a project
router.delete("/:projectId/team-members", verifyToken, ProjectController.removeTeamMember); // Remove a team member from a project
router.put("/:projectId/team-members/role", verifyToken, ProjectController.updateTeamMemberRole); // Update a team member's role


// Integration Settings
router.put("/:projectId/integration-settings", verifyToken, ProjectController.updateIntegrationSettings); // Update integration settings for a project


// Update and Delete Operations
router.put("/:id", verifyToken, ProjectController.updateById); // Update a project by ID

// Bulk Operations (must come before single delete if using same path)
router.delete("/", verifyToken, ProjectController.bulkDelete); // Bulk Delete projects (accepts array of IDs in body)
router.put("/bulk-update", verifyToken, ProjectController.bulkUpdate); // Bulk Update projects

// General Delete by ID (should be after bulk delete to avoid conflict)
router.delete("/:id", verifyToken, ProjectController.delete); // Delete a project by ID (supports soft/hard delete via query param)


// Get all projects (general catch-all for '/') - usually placed towards the end
router.get("/", verifyToken, ProjectController.getAll);

export default router;