import { Router } from "express";
import { ProjectController } from "../controllers/project.controller";
import { verifyToken } from "../middleware/auth.middleware";

const router = Router();

router.use(verifyToken);

// Create a new project
router.post("/", ProjectController.create);

// Check Service Health
router.get("/health", ProjectController.healthCheck);

// Get all projects
router.get("/", ProjectController.getAll);

// Get a specific project by ID
router.get("/:id", ProjectController.getById);

// Get a project by API key
router.get(
  "/by-api-key/:apiKey",

  ProjectController.getProjectByApiKey
);

// Update a project by ID
router.put("/:id", ProjectController.updateById);

// Delete a project by ID
router.delete("/:id", ProjectController.delete);

// Bulk Delete projects
router.delete("/", ProjectController.bulkDelete);

// // Get project usage statistics (log count, alert rules)
router.get("/:id/stats", ProjectController.getProjectStats);

// Regenerate API key for a project
router.post(
  "/:id/regenerate-api-key",

  ProjectController.regenerateApiKey
);

// Search projects
router.get("/search", ProjectController.searchProjects);

// // Activate a project by ID
// router.post("/:id/activate", activateProjectById);
// // Deactivate a project by ID
// router.post("/:id/deactivate", deactivateProjectById);

export default router;
