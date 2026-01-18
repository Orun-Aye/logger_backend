"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const alertEvent_controller_1 = require("../controllers/alertEvent.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Apply authentication middleware to all routes
router.use(auth_middleware_1.verifyToken);
// User-scoped alert routes (no projectId)
router.get("/", alertEvent_controller_1.AlertEventController.getAlerts);
router.get("/stats", alertEvent_controller_1.AlertEventController.getAlertStats);
// Project-specific alert routes
router.get("/:projectId", alertEvent_controller_1.AlertEventController.getAlerts);
router.get("/:projectId/stats", alertEvent_controller_1.AlertEventController.getAlertStats);
router.get("/:projectId/distinct/:field", alertEvent_controller_1.AlertEventController.getDistinctValues);
// Individual alert operations
router.patch("/:alertId/status", alertEvent_controller_1.AlertEventController.updateAlertStatus);
// Bulk alert operations
router.patch("/bulk-update", alertEvent_controller_1.AlertEventController.bulkUpdateAlerts);
router.delete("/", alertEvent_controller_1.AlertEventController.deleteAlerts);
// Utility operations
router.post("/auto-resolve", alertEvent_controller_1.AlertEventController.autoResolveOldAlerts);
// Legacy endpoint for backward compatibility
router.post("/:alertId/acknowledge", alertEvent_controller_1.AlertEventController.acknowledge);
router.post("/acknowledge", alertEvent_controller_1.AlertEventController.acknowledge); // Bulk acknowledge
exports.default = router;
