"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const customDashboard_controller_1 = require("../controllers/customDashboard.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validation_middleware_1 = require("../middleware/validation.middleware");
const customDashboard_validator_1 = require("../validators/customDashboard.validator");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.verifyToken);
// Dashboard CRUD
router.get("/", customDashboard_controller_1.CustomDashboardController.getByUser);
router.post("/", (0, validation_middleware_1.validate)(customDashboard_validator_1.createDashboardSchema, "body"), customDashboard_controller_1.CustomDashboardController.create);
router.get("/:dashboardId", customDashboard_controller_1.CustomDashboardController.getById);
router.put("/:dashboardId", (0, validation_middleware_1.validate)(customDashboard_validator_1.updateDashboardSchema, "body"), customDashboard_controller_1.CustomDashboardController.update);
router.delete("/:dashboardId", customDashboard_controller_1.CustomDashboardController.delete);
// Layout management
router.put("/:dashboardId/layout", (0, validation_middleware_1.validate)(customDashboard_validator_1.updateLayoutSchema, "body"), customDashboard_controller_1.CustomDashboardController.updateLayout);
// Widget management
router.post("/:dashboardId/widgets", (0, validation_middleware_1.validate)(customDashboard_validator_1.addWidgetSchema, "body"), customDashboard_controller_1.CustomDashboardController.addWidget);
router.put("/:dashboardId/widgets/:widgetId", (0, validation_middleware_1.validate)(customDashboard_validator_1.updateWidgetSchema, "body"), customDashboard_controller_1.CustomDashboardController.updateWidget);
router.delete("/:dashboardId/widgets/:widgetId", customDashboard_controller_1.CustomDashboardController.removeWidget);
// Duplicate
router.post("/:dashboardId/duplicate", customDashboard_controller_1.CustomDashboardController.duplicate);
exports.default = router;
