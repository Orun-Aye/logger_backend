"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dashboard_controller_1 = require("../controllers/dashboard.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// --- Public / Unauthenticated Routes ---
// Health Check (can be public for monitoring)
router.get("/health", dashboard_controller_1.DashboardController.healthCheck);
// --- Authenticated Routes (Require verifyToken middleware) ---
// Core Dashboard Metrics
router.get("/overview", auth_middleware_1.verifyToken, dashboard_controller_1.DashboardController.getOverview); // Get dashboard overview (summary of all key metrics)
router.get("/metrics", auth_middleware_1.verifyToken, dashboard_controller_1.dashboardValidation.metrics, dashboard_controller_1.DashboardController.getMetrics); // Get comprehensive dashboard metrics
router.get("/realtime", auth_middleware_1.verifyToken, dashboard_controller_1.DashboardController.getRealTimeMetrics); // Get real-time metrics for live dashboard
// Specialized Analytics Endpoints
router.get("/analytics/users", auth_middleware_1.verifyToken, dashboard_controller_1.DashboardController.getUserAnalytics); // Get user analytics
router.get("/timeseries", auth_middleware_1.verifyToken, dashboard_controller_1.DashboardController.getTimeSeriesData); // Get time series data
router.get("/errors", auth_middleware_1.verifyToken, dashboard_controller_1.DashboardController.getErrorAnalysis); // Get error analysis
router.get("/performance", auth_middleware_1.verifyToken, dashboard_controller_1.DashboardController.getPerformanceMetrics); // Get performance metrics
router.get("/alerts", auth_middleware_1.verifyToken, dashboard_controller_1.DashboardController.getAlerts); // Get alerts and notifications
// Project Management
router.get("/projects", auth_middleware_1.verifyToken, dashboard_controller_1.DashboardController.getUserProjects); // Get user's project list with basic health info
router.get("/projects/health", auth_middleware_1.verifyToken, dashboard_controller_1.DashboardController.getProjectHealth); // Get project health overview
// Data Export and Import
router.post("/export", auth_middleware_1.verifyToken, dashboard_controller_1.dashboardValidation.export, dashboard_controller_1.DashboardController.exportData); // Export dashboard data
// Admin Functions - Multi-User Analytics
router.post("/admin/multi-user-metrics", auth_middleware_1.verifyToken, dashboard_controller_1.dashboardValidation.multiUserMetrics, dashboard_controller_1.DashboardController.getMultiUserMetrics); // Get dashboard metrics for multiple users (admin function)
exports.default = router;
