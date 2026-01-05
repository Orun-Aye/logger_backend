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

// Get recent sessions list
router.get('/:projectId/sessions', AnalyticsController.getSessions);

// Get session details with timeline
router.get('/:projectId/sessions/:sessionId', AnalyticsController.getSessionDetails);

// Get session timeline events
router.get('/:projectId/sessions/:sessionId/timeline', AnalyticsController.getSessionTimeline);

// Get session statistics
router.get('/:projectId/sessions/stats', AnalyticsController.getSessionStats);

// Get user journey (aggregated session flow)
router.get('/:projectId/sessions/journeys', AnalyticsController.getUserJourneys);

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