import { Router } from "express";
import { AlertEventController } from "../controllers/alertEvent.controller";
import { verifyToken } from "../middleware/auth.middleware";

const router = Router();

// Apply authentication middleware to all routes
router.use(verifyToken);

// User-scoped alert routes (no projectId)
router.get("/", AlertEventController.getAlerts);
router.get("/stats", AlertEventController.getAlertStats);

// Project-specific alert routes
router.get("/:projectId", AlertEventController.getAlerts);
router.get("/:projectId/stats", AlertEventController.getAlertStats);
router.get("/:projectId/distinct/:field", AlertEventController.getDistinctValues);

// Individual alert operations
router.patch("/:alertId/status", AlertEventController.updateAlertStatus);

// Bulk alert operations
router.patch("/bulk-update", AlertEventController.bulkUpdateAlerts);
router.delete("/", AlertEventController.deleteAlerts);

// Utility operations
router.post("/auto-resolve", AlertEventController.autoResolveOldAlerts);

// Legacy endpoint for backward compatibility
router.post("/:alertId/acknowledge", AlertEventController.acknowledge);
router.post("/acknowledge", AlertEventController.acknowledge); // Bulk acknowledge

export default router;