"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const project_controller_1 = require("../controllers/project.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validation_middleware_1 = require("../middleware/validation.middleware");
const project_validator_1 = require("../validators/project.validator");
const router = (0, express_1.Router)();
// --- Public / Unauthenticated Routes ---
router.get("/health", project_controller_1.ProjectController.healthCheck);
router.get("/by-api-key", project_controller_1.ProjectController.getProjectByApiKey);
// --- Authenticated Routes (Require verifyToken middleware) ---
// Static routes MUST come before parameterized /:id routes
router.get("/summary", auth_middleware_1.verifyToken, project_controller_1.ProjectController.getProjectsSummary);
router.get("/analytics", auth_middleware_1.verifyToken, project_controller_1.ProjectController.getAnalytics);
router.get("/all", auth_middleware_1.verifyToken, project_controller_1.ProjectController.getAll);
router.get("/", auth_middleware_1.verifyToken, project_controller_1.ProjectController.getByUser);
router.post("/", auth_middleware_1.verifyToken, project_controller_1.ProjectController.create);
// Bulk operations (static paths, must come before /:id)
router.delete("/", auth_middleware_1.verifyToken, project_controller_1.ProjectController.bulkDelete);
router.put("/bulk-update", auth_middleware_1.verifyToken, project_controller_1.ProjectController.bulkUpdate);
router.post("/sync-all-log-counts", auth_middleware_1.verifyToken, project_controller_1.ProjectController.syncAllLogCounts);
// Parameterized routes with sub-paths (more specific, before bare /:id)
router.get("/:id/stats", auth_middleware_1.verifyToken, project_controller_1.ProjectController.getProjectStats);
router.get("/:id/team-members", auth_middleware_1.verifyToken, project_controller_1.ProjectController.getTeamMembers);
router.put("/:id/restore", auth_middleware_1.verifyToken, project_controller_1.ProjectController.restoreProject);
router.put("/:id/archive", auth_middleware_1.verifyToken, project_controller_1.ProjectController.archiveProject);
router.post("/:id/regenerate-api-key", auth_middleware_1.verifyToken, project_controller_1.ProjectController.regenerateApiKey);
router.post("/:sourceProjectId/duplicate", auth_middleware_1.verifyToken, project_controller_1.ProjectController.duplicateProject);
router.put("/:projectId/transfer-ownership", auth_middleware_1.verifyToken, project_controller_1.ProjectController.transferOwnership);
router.post("/:projectId/tags", auth_middleware_1.verifyToken, project_controller_1.ProjectController.addTags);
router.delete("/:projectId/tags", auth_middleware_1.verifyToken, project_controller_1.ProjectController.removeTags);
router.put("/:projectId/rate-limit", auth_middleware_1.verifyToken, project_controller_1.ProjectController.updateRateLimit);
router.put("/:projectId/sampling-config", auth_middleware_1.verifyToken, (0, validation_middleware_1.validate)(project_validator_1.samplingConfigSchema, "body"), project_controller_1.ProjectController.updateSamplingConfig);
router.post("/:projectId/sync-log-count", auth_middleware_1.verifyToken, project_controller_1.ProjectController.syncLogCount);
router.post("/:projectId/increment-log-count", auth_middleware_1.verifyToken, project_controller_1.ProjectController.incrementLogCount);
router.post("/:projectId/team-members", auth_middleware_1.verifyToken, project_controller_1.ProjectController.addTeamMember);
router.delete("/:projectId/team-members", auth_middleware_1.verifyToken, project_controller_1.ProjectController.removeTeamMember);
router.put("/:projectId/team-members/role", auth_middleware_1.verifyToken, project_controller_1.ProjectController.updateTeamMemberRole);
router.put("/:projectId/integration-settings", auth_middleware_1.verifyToken, project_controller_1.ProjectController.updateIntegrationSettings);
// Bare parameterized routes (last — catch-all for /:id)
router.get("/:id", auth_middleware_1.verifyToken, project_controller_1.ProjectController.getById);
router.put("/:id", auth_middleware_1.verifyToken, project_controller_1.ProjectController.updateById);
router.delete("/:id", auth_middleware_1.verifyToken, project_controller_1.ProjectController.delete);
exports.default = router;
