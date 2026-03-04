import { Router } from "express";
import { CustomDashboardController } from "../controllers/customDashboard.controller";
import { verifyToken } from "../middleware/auth.middleware";
import { validate } from "../middleware/validation.middleware";
import {
  createDashboardSchema,
  updateDashboardSchema,
  updateLayoutSchema,
  addWidgetSchema,
  updateWidgetSchema,
} from "../validators/customDashboard.validator";

const router = Router();

router.use(verifyToken);

// Dashboard CRUD
router.get("/", CustomDashboardController.getByUser);
router.post("/", validate(createDashboardSchema, "body"), CustomDashboardController.create);
router.get("/:dashboardId", CustomDashboardController.getById);
router.put("/:dashboardId", validate(updateDashboardSchema, "body"), CustomDashboardController.update);
router.delete("/:dashboardId", CustomDashboardController.delete);

// Layout management
router.put("/:dashboardId/layout", validate(updateLayoutSchema, "body"), CustomDashboardController.updateLayout);

// Widget management
router.post("/:dashboardId/widgets", validate(addWidgetSchema, "body"), CustomDashboardController.addWidget);
router.put("/:dashboardId/widgets/:widgetId", validate(updateWidgetSchema, "body"), CustomDashboardController.updateWidget);
router.delete("/:dashboardId/widgets/:widgetId", CustomDashboardController.removeWidget);

// Duplicate
router.post("/:dashboardId/duplicate", CustomDashboardController.duplicate);

export default router;
