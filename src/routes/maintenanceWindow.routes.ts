import { Router } from "express";
import { MaintenanceWindowController } from "../controllers/maintenanceWindow.controller";
import { verifyToken } from "../middleware/auth.middleware";

const router = Router();

router.use(verifyToken);

// CRUD operations
router.post("/", MaintenanceWindowController.create);
router.get("/project/:projectId", MaintenanceWindowController.getByProject);
router.get("/project/:projectId/active", MaintenanceWindowController.getActiveByProject);
router.get("/:id", MaintenanceWindowController.getById);
router.put("/:id", MaintenanceWindowController.update);
router.delete("/:id", MaintenanceWindowController.delete);

// Additional operations
router.post("/:id/end", MaintenanceWindowController.endEarly);

export default router;
