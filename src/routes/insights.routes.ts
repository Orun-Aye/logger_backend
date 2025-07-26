import { Router } from "express";
import { verifyToken } from "../middleware/auth.middleware";
import { DashboardInsightsController } from "../controllers/insights.controller";

const router = Router();

router.use(verifyToken);

// Log Aggregation and Analytics
router.get(
  "/insights/:projectId",
  DashboardInsightsController.getProjectInsights
);

// Invalidating caching for project
router.get(
  "/insights/:projectId/invalidate",
  DashboardInsightsController.invalidateProjectCache
);

export default router;
