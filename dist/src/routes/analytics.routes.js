"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/analytics.routes.ts
const express_1 = require("express");
const analytics_controller_1 = require("../controllers/analytics.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// All analytics endpoints require authentication
router.use(auth_middleware_1.verifyToken);
// ============================================================================
// ERROR ANALYTICS - Dashboard 1
// ============================================================================
// Get error timeline data (hourly/daily aggregation)
router.get('/:projectId/errors/timeline', analytics_controller_1.AnalyticsController.getErrorTimeline);
// Get top errors with details
router.get('/:projectId/errors/top', analytics_controller_1.AnalyticsController.getTopErrors);
// Get error distribution by type
router.get('/:projectId/errors/distribution', analytics_controller_1.AnalyticsController.getErrorDistribution);
// Get error stats (total, rate, affected users, MTTR)
router.get('/:projectId/errors/stats', analytics_controller_1.AnalyticsController.getErrorStats);
// Get error details by ID
router.get('/:projectId/errors/:errorId/details', analytics_controller_1.AnalyticsController.getErrorDetails);
// Get error occurrences over time (for trending)
router.get('/:projectId/errors/trends', analytics_controller_1.AnalyticsController.getErrorTrends);
// ============================================================================
// PERFORMANCE ANALYTICS - Dashboard 2
// ============================================================================
// Get performance metrics timeline (LCP, FCP, TTFB, CLS)
router.get('/:projectId/performance/timeline', analytics_controller_1.AnalyticsController.getPerformanceTimeline);
// Get Core Web Vitals summary
router.get('/:projectId/performance/web-vitals', analytics_controller_1.AnalyticsController.getWebVitals);
// Get resource performance (API endpoints, static assets)
router.get('/:projectId/performance/resources', analytics_controller_1.AnalyticsController.getResourcePerformance);
// Get page performance metrics
router.get('/:projectId/performance/pages', analytics_controller_1.AnalyticsController.getPagePerformance);
// Get performance score breakdown
router.get('/:projectId/performance/score', analytics_controller_1.AnalyticsController.getPerformanceScore);
// Get slowest endpoints
router.get('/:projectId/performance/slowest', analytics_controller_1.AnalyticsController.getSlowestEndpoints);
// ============================================================================
// REAL-TIME ACTIVITY FEED - Dashboard 3
// ============================================================================
// Get recent logs (paginated, filterable)
router.get('/:projectId/activity/feed', analytics_controller_1.AnalyticsController.getActivityFeed);
// Get activity stats by level
router.get('/:projectId/activity/stats', analytics_controller_1.AnalyticsController.getActivityStats);
// Get distinct filter values (for filter dropdowns)
router.get('/:projectId/activity/filters/values', analytics_controller_1.AnalyticsController.getFilterValues);
// Stream real-time logs (polling endpoint - WebSocket is separate)
router.get('/:projectId/activity/stream', analytics_controller_1.AnalyticsController.streamActivity);
// ============================================================================
// SESSION ANALYTICS - Dashboard 4
// ============================================================================
// Get session statistics (must be before /:sessionId to avoid being caught by it)
router.get('/:projectId/sessions/stats', analytics_controller_1.AnalyticsController.getSessionStats);
// Get user journey (aggregated session flow)
router.get('/:projectId/sessions/journeys', analytics_controller_1.AnalyticsController.getUserJourneys);
// Get recent sessions list
router.get('/:projectId/sessions', analytics_controller_1.AnalyticsController.getSessions);
// Get session details with timeline
router.get('/:projectId/sessions/:sessionId', analytics_controller_1.AnalyticsController.getSessionDetails);
// Get session timeline events
router.get('/:projectId/sessions/:sessionId/timeline', analytics_controller_1.AnalyticsController.getSessionTimeline);
// ============================================================================
// ENVIRONMENT ANALYTICS
// ============================================================================
// Get per-environment statistics for a project
router.get('/:projectId/environments/stats', analytics_controller_1.AnalyticsController.getEnvironmentStats);
// ============================================================================
// CROSS-DASHBOARD UTILITIES
// ============================================================================
// Get dashboard overview (all key metrics)
router.get('/:projectId/overview', analytics_controller_1.AnalyticsController.getDashboardOverview);
// Export analytics data
router.post('/:projectId/export', analytics_controller_1.AnalyticsController.exportAnalytics);
// Get alerts/anomalies
router.get('/:projectId/alerts', analytics_controller_1.AnalyticsController.getAlerts);
exports.default = router;
