// src/routes/analytics.routes.ts
import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

// All analytics endpoints require authentication
router.use(verifyToken);

// ============================================================================
// ERROR ANALYTICS - Dashboard 1
// ============================================================================

// Get error timeline data (hourly/daily aggregation)
router.get('/:projectId/errors/timeline', AnalyticsController.getErrorTimeline);

// Get top errors with details
router.get('/:projectId/errors/top', AnalyticsController.getTopErrors);

// Get error distribution by type
router.get('/:projectId/errors/distribution', AnalyticsController.getErrorDistribution);

// Get error stats (total, rate, affected users, MTTR)
router.get('/:projectId/errors/stats', AnalyticsController.getErrorStats);

// Get error details by ID
router.get('/:projectId/errors/:errorId/details', AnalyticsController.getErrorDetails);

// Get error occurrences over time (for trending)
router.get('/:projectId/errors/trends', AnalyticsController.getErrorTrends);

// ============================================================================
// PERFORMANCE ANALYTICS - Dashboard 2
// ============================================================================

// Get performance metrics timeline (LCP, FCP, TTFB, CLS)
router.get('/:projectId/performance/timeline', AnalyticsController.getPerformanceTimeline);

// Get Core Web Vitals summary
router.get('/:projectId/performance/web-vitals', AnalyticsController.getWebVitals);

// Get resource performance (API endpoints, static assets)
router.get('/:projectId/performance/resources', AnalyticsController.getResourcePerformance);

// Get page performance metrics
router.get('/:projectId/performance/pages', AnalyticsController.getPagePerformance);

// Get performance score breakdown
router.get('/:projectId/performance/score', AnalyticsController.getPerformanceScore);

// Get slowest endpoints
router.get('/:projectId/performance/slowest', AnalyticsController.getSlowestEndpoints);

// ============================================================================
// REAL-TIME ACTIVITY FEED - Dashboard 3
// ============================================================================

// Get recent logs (paginated, filterable)
router.get('/:projectId/activity/feed', AnalyticsController.getActivityFeed);

// Get activity stats by level
router.get('/:projectId/activity/stats', AnalyticsController.getActivityStats);

// Get distinct filter values (for filter dropdowns)
router.get('/:projectId/activity/filters/values', AnalyticsController.getFilterValues);

// Stream real-time logs (polling endpoint - WebSocket is separate)
router.get('/:projectId/activity/stream', AnalyticsController.streamActivity);

// ============================================================================
// SESSION ANALYTICS - Dashboard 4
// ============================================================================

// Get session statistics (must be before /:sessionId to avoid being caught by it)
router.get('/:projectId/sessions/stats', AnalyticsController.getSessionStats);

// Get user journey (aggregated session flow)
router.get('/:projectId/sessions/journeys', AnalyticsController.getUserJourneys);

// Get recent sessions list
router.get('/:projectId/sessions', AnalyticsController.getSessions);

// Get session details with timeline
router.get('/:projectId/sessions/:sessionId', AnalyticsController.getSessionDetails);

// Get session timeline events
router.get('/:projectId/sessions/:sessionId/timeline', AnalyticsController.getSessionTimeline);

// ============================================================================
// ENVIRONMENT ANALYTICS
// ============================================================================

// Get per-environment statistics for a project
router.get('/:projectId/environments/stats', AnalyticsController.getEnvironmentStats);

// ============================================================================
// NETWORK ANALYTICS
// ============================================================================

// Get network overview (total requests, failure rate, avg duration, status distribution)
router.get('/:projectId/network/overview', AnalyticsController.getNetworkOverview);

// Get paginated network requests with filters
router.get('/:projectId/network/requests', AnalyticsController.getNetworkRequests);

// Get network request timeline (hourly/daily aggregation)
router.get('/:projectId/network/timeline', AnalyticsController.getNetworkTimeline);

// Get top network endpoints by request count
router.get('/:projectId/network/top-endpoints', AnalyticsController.getNetworkTopEndpoints);

// Get slowest network endpoints
router.get('/:projectId/network/slowest', AnalyticsController.getNetworkSlowest);

// ============================================================================
// INTERACTION ANALYTICS
// ============================================================================

// Get interaction overview (clicks, scrolls, keypresses with period comparison)
router.get('/:projectId/interactions/overview', AnalyticsController.getInteractionOverview);

// Get interaction timeline (hourly/daily by type)
router.get('/:projectId/interactions/timeline', AnalyticsController.getInteractionTimeline);

// Get top clicked elements
router.get('/:projectId/interactions/top-elements', AnalyticsController.getInteractionTopElements);

// Get most interacted elements (all types)
router.get('/:projectId/interactions/most-clicked', AnalyticsController.getInteractionMostClicked);

// ============================================================================
// CONSOLE ANALYTICS
// ============================================================================

// Get console overview (total, by level, with period comparison)
router.get('/:projectId/console/overview', AnalyticsController.getConsoleOverview);

// Get paginated console messages with filters
router.get('/:projectId/console/messages', AnalyticsController.getConsoleMessages);

// Get console message timeline (hourly/daily by level)
router.get('/:projectId/console/timeline', AnalyticsController.getConsoleTimeline);

// ============================================================================
// PAGEVIEW ANALYTICS
// ============================================================================

// Get pageview overview (total, unique pages, top page, period comparison)
router.get('/:projectId/pageviews/overview', AnalyticsController.getPageviewOverview);

// Get pageview timeline (hourly/daily counts)
router.get('/:projectId/pageviews/timeline', AnalyticsController.getPageviewTimeline);

// Get top pages by views
router.get('/:projectId/pageviews/top-pages', AnalyticsController.getPageviewTopPages);

// Get pageview referrers
router.get('/:projectId/pageviews/referrers', AnalyticsController.getPageviewReferrers);

// Get page navigation flow (from -> to transitions)
router.get('/:projectId/pageviews/navigation-flow', AnalyticsController.getPageviewNavigationFlow);

// ============================================================================
// CROSS-DASHBOARD UTILITIES
// ============================================================================

// Get dashboard overview (all key metrics)
router.get('/:projectId/overview', AnalyticsController.getDashboardOverview);

// Export analytics data
router.post('/:projectId/export', AnalyticsController.exportAnalytics);

// Get alerts/anomalies
router.get('/:projectId/alerts', AnalyticsController.getAlerts);

export default router;