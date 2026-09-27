import { Router } from "express";
import { ProjectController } from "../controllers/project.controller";
import { verifyToken } from "../middleware/auth.middleware";
import { validate } from "../middleware/validation.middleware";
import { authorizeProjectAccess } from "../middleware/authorizeProjectAccess";
import {
  samplingConfigSchema,
  notificationSettingsSchema,
} from "../validators/project.validator";

const router = Router();

// --- Public / Unauthenticated Routes ---
router.get("/health", ProjectController.healthCheck);
router.get("/by-api-key", ProjectController.getProjectByApiKey);

// --- Authenticated Routes (Require verifyToken middleware) ---

// Static routes MUST come before parameterized /:id routes
router.get("/summary", verifyToken, ProjectController.getProjectsSummary);
router.get("/analytics", verifyToken, ProjectController.getAnalytics);
router.get("/all", verifyToken, ProjectController.getAll);
router.get("/", verifyToken, ProjectController.getByUser);
router.post("/", verifyToken, ProjectController.create);

// Bulk operations (static paths, must come before /:id)
router.delete("/", verifyToken, ProjectController.bulkDelete);
router.put("/bulk-update", verifyToken, ProjectController.bulkUpdate);
router.post("/sync-all-log-counts", verifyToken, ProjectController.syncAllLogCounts);

// Parameterized routes with sub-paths (more specific, before bare /:id)
router.get("/:id/stats", verifyToken, ProjectController.getProjectStats);
router.get("/:id/team-members", verifyToken, ProjectController.getTeamMembers);
router.put("/:id/restore", verifyToken, ProjectController.restoreProject);
router.put("/:id/archive", verifyToken, ProjectController.archiveProject);
router.post("/:id/regenerate-api-key", verifyToken, ProjectController.regenerateApiKey);
router.post("/:sourceProjectId/duplicate", verifyToken, ProjectController.duplicateProject);
router.put("/:projectId/transfer-ownership", verifyToken, ProjectController.transferOwnership);
router.post("/:projectId/tags", verifyToken, ProjectController.addTags);
router.delete("/:projectId/tags", verifyToken, ProjectController.removeTags);
router.put("/:projectId/rate-limit", verifyToken, ProjectController.updateRateLimit);
router.put("/:projectId/sampling-config", verifyToken, validate(samplingConfigSchema, "body"), ProjectController.updateSamplingConfig);
router.put("/:projectId/notification-settings", verifyToken, authorizeProjectAccess, validate(notificationSettingsSchema, "body"), ProjectController.updateNotificationSettings);
router.post("/:projectId/sync-log-count", verifyToken, ProjectController.syncLogCount);
router.post("/:projectId/increment-log-count", verifyToken, ProjectController.incrementLogCount);
router.post("/:projectId/team-members", verifyToken, ProjectController.addTeamMember);
router.delete("/:projectId/team-members", verifyToken, ProjectController.removeTeamMember);
router.put("/:projectId/team-members/role", verifyToken, ProjectController.updateTeamMemberRole);
router.put("/:projectId/integration-settings", verifyToken, ProjectController.updateIntegrationSettings);

// Bare parameterized routes (last — catch-all for /:id)
router.get("/:id", verifyToken, ProjectController.getById);
router.put("/:id", verifyToken, ProjectController.updateById);
router.delete("/:id", verifyToken, ProjectController.delete);

export default router;
