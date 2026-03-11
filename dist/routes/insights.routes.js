"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const insights_controller_1 = require("../controllers/insights.controller");
const ai_insights_controller_1 = require("../controllers/ai-insights.controller");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.verifyToken);
// Statistical insights (existing)
router.get("/insights/:projectId", insights_controller_1.DashboardInsightsController.getProjectInsights);
router.get("/insights/:projectId/invalidate", insights_controller_1.DashboardInsightsController.invalidateProjectCache);
// AI-powered insights (Phase 3)
router.get("/insights/:projectId/root-cause/:errorId", ai_insights_controller_1.AIInsightsController.getRootCause);
router.post("/insights/:projectId/ask", ai_insights_controller_1.AIInsightsController.askQuestion);
router.get("/insights/:projectId/suggestions", ai_insights_controller_1.AIInsightsController.getOptimizationSuggestions);
router.get("/insights/:projectId/enriched", ai_insights_controller_1.AIInsightsController.getEnrichedInsights);
exports.default = router;
