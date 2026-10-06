import { Router } from "express";
import { verifyToken } from "../middleware/auth.middleware";
import { DashboardInsightsController } from "../controllers/insights.controller";
import { AIInsightsController } from "../controllers/ai-insights.controller";

const router = Router();

router.use(verifyToken);

// Mounted at /api/v1/insights, so paths here must not repeat "/insights"

// Statistical insights (existing)
router.get(
  "/:projectId",
  DashboardInsightsController.getProjectInsights
);

router.get(
  "/:projectId/invalidate",
  DashboardInsightsController.invalidateProjectCache
);

// AI-powered insights (Phase 3)
router.get(
  "/:projectId/root-cause/:errorId",
  AIInsightsController.getRootCause
);

router.post(
  "/:projectId/ask",
  AIInsightsController.askQuestion
);

router.get(
  "/:projectId/suggestions",
  AIInsightsController.getOptimizationSuggestions
);

router.get(
  "/:projectId/enriched",
  AIInsightsController.getEnrichedInsights
);

export default router;
