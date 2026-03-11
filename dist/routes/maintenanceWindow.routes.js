"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const maintenanceWindow_controller_1 = require("../controllers/maintenanceWindow.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.verifyToken);
// CRUD operations
router.post("/", maintenanceWindow_controller_1.MaintenanceWindowController.create);
router.get("/project/:projectId", maintenanceWindow_controller_1.MaintenanceWindowController.getByProject);
router.get("/project/:projectId/active", maintenanceWindow_controller_1.MaintenanceWindowController.getActiveByProject);
router.get("/:id", maintenanceWindow_controller_1.MaintenanceWindowController.getById);
router.put("/:id", maintenanceWindow_controller_1.MaintenanceWindowController.update);
router.delete("/:id", maintenanceWindow_controller_1.MaintenanceWindowController.delete);
// Additional operations
router.post("/:id/end", maintenanceWindow_controller_1.MaintenanceWindowController.endEarly);
exports.default = router;
