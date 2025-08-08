import { Router } from "express";
import {
  DashboardController,
  dashboardValidation,
} from "../controllers/dashboard.controller";
import { verifyToken } from "../middleware/auth.middleware";

const router = Router();

// --- Public / Unauthenticated Routes ---
// Health Check (can be public for monitoring)
router.get("/health", DashboardController.healthCheck);

// --- Authenticated Routes (Require verifyToken middleware) ---

// Core Dashboard Metrics
router.get("/overview", verifyToken, DashboardController.getOverview); // Get dashboard overview (summary of all key metrics)
router.get(
  "/metrics",
  verifyToken,
  dashboardValidation.metrics,
  DashboardController.getMetrics
); // Get comprehensive dashboard metrics
router.get("/realtime", verifyToken, DashboardController.getRealTimeMetrics); // Get real-time metrics for live dashboard

// Specialized Analytics Endpoints
router.get(
  "/analytics/users",
  verifyToken,
  DashboardController.getUserAnalytics
); // Get user analytics
router.get("/timeseries", verifyToken, DashboardController.getTimeSeriesData); // Get time series data
router.get("/errors", verifyToken, DashboardController.getErrorAnalysis); // Get error analysis
router.get(
  "/performance",
  verifyToken,
  DashboardController.getPerformanceMetrics
); // Get performance metrics
router.get("/alerts", verifyToken, DashboardController.getAlerts); // Get alerts and notifications

// Project Management
router.get("/projects", verifyToken, DashboardController.getUserProjects); // Get user's project list with basic health info
router.get(
  "/projects/health",
  verifyToken,
  DashboardController.getProjectHealth
); // Get project health overview

// Data Export and Import
router.post(
  "/export",
  verifyToken,
  dashboardValidation.export,
  DashboardController.exportData
); // Export dashboard data

// Admin Functions - Multi-User Analytics
router.post(
  "/admin/multi-user-metrics",
  verifyToken,
  dashboardValidation.multiUserMetrics,
  DashboardController.getMultiUserMetrics
); // Get dashboard metrics for multiple users (admin function)

export default router;
