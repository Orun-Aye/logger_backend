import { Router } from "express";
import { verifyToken } from "../middleware/auth.middleware";
import { DashboardInsightsController } from "../controllers/insights.controller";
import { AIInsightsController } from "../controllers/ai-insights.controller";

const router = Router();

router.use(verifyToken);

// Statistical insights (existing)
router.get(
  "/insights/:projectId",
  DashboardInsightsController.getProjectInsights
);

router.get(
  "/insights/:projectId/invalidate",
  DashboardInsightsController.invalidateProjectCache
);

// AI-powered insights (Phase 3)
router.get(
  "/insights/:projectId/root-cause/:errorId",
  AIInsightsController.getRootCause
);

router.post(
  "/insights/:projectId/ask",
  AIInsightsController.askQuestion
);

router.get(
  "/insights/:projectId/suggestions",
  AIInsightsController.getOptimizationSuggestions
);

router.get(
  "/insights/:projectId/enriched",
  AIInsightsController.getEnrichedInsights
);

export default router;
