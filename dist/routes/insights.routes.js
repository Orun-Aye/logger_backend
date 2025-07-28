"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const insights_controller_1 = require("../controllers/insights.controller");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.verifyToken);
// Log Aggregation and Analytics
router.get("/insights/:projectId", insights_controller_1.DashboardInsightsController.getProjectInsights);
// Invalidating caching for project
router.get("/insights/:projectId/invalidate", insights_controller_1.DashboardInsightsController.invalidateProjectCache);
exports.default = router;
