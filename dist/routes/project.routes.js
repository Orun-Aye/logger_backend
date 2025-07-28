"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const project_controller_1 = require("../controllers/project.controller");
const router = (0, express_1.Router)();
// Create a new project
router.post("/", project_controller_1.ProjectController.create);
// Check Service Health
router.get("/health", project_controller_1.ProjectController.healthCheck);
// Get all projects
router.get("/", project_controller_1.ProjectController.getAll);
// Get a specific project by ID
router.get("/:id", project_controller_1.ProjectController.getById);
// Get a project by API key
router.get("/by-api-key/:apiKey", project_controller_1.ProjectController.getProjectByApiKey);
// Update a project by ID
router.put("/:id", project_controller_1.ProjectController.updateById);
// Delete a project by ID
router.delete("/:id", project_controller_1.ProjectController.delete);
// Bulk Delete projects
router.delete("/", project_controller_1.ProjectController.bulkDelete);
// // Get project usage statistics (log count, alert rules)
router.get("/:id/stats", project_controller_1.ProjectController.getProjectStats);
// Regenerate API key for a project
router.post("/:id/regenerate-api-key", project_controller_1.ProjectController.regenerateApiKey);
// Search projects
router.get("/search", project_controller_1.ProjectController.searchProjects);
// // Activate a project by ID
// router.post("/:id/activate", activateProjectById);
// // Deactivate a project by ID
// router.post("/:id/deactivate", deactivateProjectById);
exports.default = router;
