import { Router } from "express";
import { ProjectController } from "../controllers/project.controller";
import { verifyToken } from "../middleware/auth.middleware";

const router = Router();


// Create a new project
router.post("/", verifyToken, ProjectController.create);

// Check Service Health
router.get("/health", verifyToken, ProjectController.healthCheck);

// Get all projects
router.get("/", verifyToken, ProjectController.getAll);

// Get a specific project by ID
router.get("/:id", verifyToken, ProjectController.getById);

// Get a project by API key
router.get(
  "/by-api-key/:apiKey",
  verifyToken,
  ProjectController.getProjectByApiKey
);

// Update a project by ID
router.put("/:id", verifyToken, ProjectController.updateById);

// Delete a project by ID
router.delete("/:id", verifyToken, ProjectController.delete);

// Bulk Delete projects
router.delete("/", verifyToken, ProjectController.bulkDelete);

// // Get project usage statistics (log count, alert rules)
router.get("/:id/stats", verifyToken, ProjectController.getProjectStats);

// Regenerate API key for a project
router.post(
  "/:id/regenerate-api-key",
  verifyToken,
  ProjectController.regenerateApiKey
);

// Search projects
router.get("/search", verifyToken, ProjectController.searchProjects);

// // Activate a project by ID
// router.post("/:id/activate", activateProjectById);
// // Deactivate a project by ID
// router.post("/:id/deactivate", deactivateProjectById);

export default router;
