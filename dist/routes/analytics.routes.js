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
// NETWORK ANALYTICS
// ============================================================================
// Get network overview (total requests, failure rate, avg duration, status distribution)
router.get('/:projectId/network/overview', analytics_controller_1.AnalyticsController.getNetworkOverview);
// Get paginated network requests with filters
router.get('/:projectId/network/requests', analytics_controller_1.AnalyticsController.getNetworkRequests);
// Get network request timeline (hourly/daily aggregation)
router.get('/:projectId/network/timeline', analytics_controller_1.AnalyticsController.getNetworkTimeline);
// Get top network endpoints by request count
router.get('/:projectId/network/top-endpoints', analytics_controller_1.AnalyticsController.getNetworkTopEndpoints);
// Get slowest network endpoints
router.get('/:projectId/network/slowest', analytics_controller_1.AnalyticsController.getNetworkSlowest);
// ============================================================================
// INTERACTION ANALYTICS
// ============================================================================
// Get interaction overview (clicks, scrolls, keypresses with period comparison)
router.get('/:projectId/interactions/overview', analytics_controller_1.AnalyticsController.getInteractionOverview);
// Get interaction timeline (hourly/daily by type)
router.get('/:projectId/interactions/timeline', analytics_controller_1.AnalyticsController.getInteractionTimeline);
// Get top clicked elements
router.get('/:projectId/interactions/top-elements', analytics_controller_1.AnalyticsController.getInteractionTopElements);
// Get most interacted elements (all types)
router.get('/:projectId/interactions/most-clicked', analytics_controller_1.AnalyticsController.getInteractionMostClicked);
// ============================================================================
// CONSOLE ANALYTICS
// ============================================================================
// Get console overview (total, by level, with period comparison)
router.get('/:projectId/console/overview', analytics_controller_1.AnalyticsController.getConsoleOverview);
// Get paginated console messages with filters
router.get('/:projectId/console/messages', analytics_controller_1.AnalyticsController.getConsoleMessages);
// Get console message timeline (hourly/daily by level)
router.get('/:projectId/console/timeline', analytics_controller_1.AnalyticsController.getConsoleTimeline);
// ============================================================================
// PAGEVIEW ANALYTICS
// ============================================================================
// Get pageview overview (total, unique pages, top page, period comparison)
router.get('/:projectId/pageviews/overview', analytics_controller_1.AnalyticsController.getPageviewOverview);
// Get pageview timeline (hourly/daily counts)
router.get('/:projectId/pageviews/timeline', analytics_controller_1.AnalyticsController.getPageviewTimeline);
// Get top pages by views
router.get('/:projectId/pageviews/top-pages', analytics_controller_1.AnalyticsController.getPageviewTopPages);
// Get pageview referrers
router.get('/:projectId/pageviews/referrers', analytics_controller_1.AnalyticsController.getPageviewReferrers);
// Get page navigation flow (from -> to transitions)
router.get('/:projectId/pageviews/navigation-flow', analytics_controller_1.AnalyticsController.getPageviewNavigationFlow);
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
