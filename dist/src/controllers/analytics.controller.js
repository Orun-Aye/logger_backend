"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsController = void 0;
const analytics_service_1 = require("../services/analytics.service");
class AnalyticsController {
    static handleError(error, res, defaultMessage) {
        console.error(`AnalyticsController Error: ${error.message}`, error.stack);
        return res.status(500).json({
            status: 'error',
            message: defaultMessage,
            errors: [error.message],
        });
    }
    // ============================================================================
    // ERROR ANALYTICS
    // ============================================================================
    static async getErrorTimeline(req, res) {
        try {
            const { projectId } = req.params;
            const { timeRange = '24h', granularity = 'hour' } = req.query;
            const data = await analytics_service_1.AnalyticsService.getErrorTimeline(projectId, {
                timeRange: timeRange,
                granularity: granularity,
            });
            return res.status(200).json({
                status: 'success',
                message: 'Error timeline fetched successfully',
                data,
            });
        }
        catch (error) {
            return AnalyticsController.handleError(error, res, 'Failed to fetch error timeline');
        }
    }
    static async getTopErrors(req, res) {
        try {
            const { projectId } = req.params;
            const { limit = '10', timeRange = '24h' } = req.query;
            const data = await analytics_service_1.AnalyticsService.getTopErrors(projectId, {
                limit: parseInt(limit),
                timeRange: timeRange,
            });
            return res.status(200).json({
                status: 'success',
                message: 'Top errors fetched successfully',
                data,
            });
        }
        catch (error) {
            return AnalyticsController.handleError(error, res, 'Failed to fetch top errors');
        }
    }
    static async getErrorDistribution(req, res) {
        try {
            const { projectId } = req.params;
            const { timeRange = '24h' } = req.query;
            const data = await analytics_service_1.AnalyticsService.getErrorDistribution(projectId, {
                timeRange: timeRange,
            });
            return res.status(200).json({
                status: 'success',
                message: 'Error distribution fetched successfully',
                data,
            });
        }
        catch (error) {
            return AnalyticsController.handleError(error, res, 'Failed to fetch error distribution');
        }
    }
    static async getErrorStats(req, res) {
        try {
            const { projectId } = req.params;
            const { timeRange = '24h' } = req.query;
            const data = await analytics_service_1.AnalyticsService.getErrorStats(projectId, {
                timeRange: timeRange,
            });
            return res.status(200).json({
                status: 'success',
                message: 'Error stats fetched successfully',
                data,
            });
        }
        catch (error) {
            return AnalyticsController.handleError(error, res, 'Failed to fetch error stats');
        }
    }
    static async getErrorDetails(req, res) {
        try {
            const { projectId, errorId } = req.params;
            const data = await analytics_service_1.AnalyticsService.getErrorDetails(projectId, errorId);
            return res.status(200).json({
                status: 'success',
                message: 'Error details fetched successfully',
                data,
            });
        }
        catch (error) {
            return AnalyticsController.handleError(error, res, 'Failed to fetch error details');
        }
    }
    static async getErrorTrends(req, res) {
        try {
            const { projectId } = req.params;
            const { timeRange = '7d', groupBy = 'day' } = req.query;
            const data = await analytics_service_1.AnalyticsService.getErrorTrends(projectId, {
                timeRange: timeRange,
                groupBy: groupBy,
            });
            return res.status(200).json({
                status: 'success',
                message: 'Error trends fetched successfully',
                data,
            });
        }
        catch (error) {
            return AnalyticsController.handleError(error, res, 'Failed to fetch error trends');
        }
    }
    // ============================================================================
    // PERFORMANCE ANALYTICS
    // ============================================================================
    static async getPerformanceTimeline(req, res) {
        try {
            const { projectId } = req.params;
            const { timeRange = '24h', metric = 'all' } = req.query;
            const data = await analytics_service_1.AnalyticsService.getPerformanceTimeline(projectId, {
                timeRange: timeRange,
                metric: metric,
            });
            return res.status(200).json({
                status: 'success',
                message: 'Performance timeline fetched successfully',
                data,
            });
        }
        catch (error) {
            return AnalyticsController.handleError(error, res, 'Failed to fetch performance timeline');
        }
    }
    static async getWebVitals(req, res) {
        try {
            const { projectId } = req.params;
            const { timeRange = '24h' } = req.query;
            const data = await analytics_service_1.AnalyticsService.getWebVitals(projectId, {
                timeRange: timeRange,
            });
            return res.status(200).json({
                status: 'success',
                message: 'Web Vitals fetched successfully',
                data,
            });
        }
        catch (error) {
            return AnalyticsController.handleError(error, res, 'Failed to fetch Web Vitals');
        }
    }
    static async getResourcePerformance(req, res) {
        try {
            const { projectId } = req.params;
            const { timeRange = '24h', limit = '10' } = req.query;
            const data = await analytics_service_1.AnalyticsService.getResourcePerformance(projectId, {
                timeRange: timeRange,
                limit: parseInt(limit),
            });
            return res.status(200).json({
                status: 'success',
                message: 'Resource performance fetched successfully',
                data,
            });
        }
        catch (error) {
            return AnalyticsController.handleError(error, res, 'Failed to fetch resource performance');
        }
    }
    static async getPagePerformance(req, res) {
        try {
            const { projectId } = req.params;
            const { timeRange = '24h', limit = '10' } = req.query;
            const data = await analytics_service_1.AnalyticsService.getPagePerformance(projectId, {
                timeRange: timeRange,
                limit: parseInt(limit),
            });
            return res.status(200).json({
                status: 'success',
                message: 'Page performance fetched successfully',
                data,
            });
        }
        catch (error) {
            return AnalyticsController.handleError(error, res, 'Failed to fetch page performance');
        }
    }
    static async getPerformanceScore(req, res) {
        try {
            const { projectId } = req.params;
            const { timeRange = '24h' } = req.query;
            const data = await analytics_service_1.AnalyticsService.getPerformanceScore(projectId, {
                timeRange: timeRange,
            });
            return res.status(200).json({
                status: 'success',
                message: 'Performance score fetched successfully',
                data,
            });
        }
        catch (error) {
            return AnalyticsController.handleError(error, res, 'Failed to fetch performance score');
        }
    }
    static async getSlowestEndpoints(req, res) {
        try {
            const { projectId } = req.params;
            const { timeRange = '24h', limit = '10' } = req.query;
            const data = await analytics_service_1.AnalyticsService.getSlowestEndpoints(projectId, {
                timeRange: timeRange,
                limit: parseInt(limit),
            });
            return res.status(200).json({
                status: 'success',
                message: 'Slowest endpoints fetched successfully',
                data,
            });
        }
        catch (error) {
            return AnalyticsController.handleError(error, res, 'Failed to fetch slowest endpoints');
        }
    }
    // ============================================================================
    // REAL-TIME ACTIVITY FEED
    // ============================================================================
    static async getActivityFeed(req, res) {
        try {
            const { projectId } = req.params;
            const { page = '1', limit = '50', level, eventType, service, environment, search, } = req.query;
            const data = await analytics_service_1.AnalyticsService.getActivityFeed(projectId, {
                page: parseInt(page),
                limit: parseInt(limit),
                level: level,
                eventType: eventType,
                service: service,
                environment: environment,
                search: search,
            });
            return res.status(200).json({
                status: 'success',
                message: 'Activity feed fetched successfully',
                data: data.logs,
                meta: data.pagination,
            });
        }
        catch (error) {
            return AnalyticsController.handleError(error, res, 'Failed to fetch activity feed');
        }
    }
    static async getActivityStats(req, res) {
        try {
            const { projectId } = req.params;
            const { timeRange = '1h' } = req.query;
            const data = await analytics_service_1.AnalyticsService.getActivityStats(projectId, {
                timeRange: timeRange,
            });
            return res.status(200).json({
                status: 'success',
                message: 'Activity stats fetched successfully',
                data,
            });
        }
        catch (error) {
            return AnalyticsController.handleError(error, res, 'Failed to fetch activity stats');
        }
    }
    static async getFilterValues(req, res) {
        try {
            const { projectId } = req.params;
            const data = await analytics_service_1.AnalyticsService.getFilterValues(projectId);
            return res.status(200).json({
                status: 'success',
                message: 'Filter values fetched successfully',
                data,
            });
        }
        catch (error) {
            return AnalyticsController.handleError(error, res, 'Failed to fetch filter values');
        }
    }
    static async streamActivity(req, res) {
        try {
            const { projectId } = req.params;
            const { since } = req.query;
            const data = await analytics_service_1.AnalyticsService.streamActivity(projectId, {
                since: since ? new Date(since) : new Date(Date.now() - 10000),
            });
            return res.status(200).json({
                status: 'success',
                message: 'Activity stream fetched successfully',
                data,
            });
        }
        catch (error) {
            return AnalyticsController.handleError(error, res, 'Failed to stream activity');
        }
    }
    // ============================================================================
    // SESSION ANALYTICS
    // ============================================================================
    static async getSessions(req, res) {
        try {
            const { projectId } = req.params;
            const { page = '1', limit = '20', timeRange = '2h' } = req.query;
            const data = await analytics_service_1.AnalyticsService.getSessions(projectId, {
                page: parseInt(page),
                limit: parseInt(limit),
                timeRange: timeRange,
            });
            return res.status(200).json({
                status: 'success',
                message: 'Sessions fetched successfully',
                data: data.sessions,
                meta: data.pagination,
            });
        }
        catch (error) {
            return AnalyticsController.handleError(error, res, 'Failed to fetch sessions');
        }
    }
    static async getSessionDetails(req, res) {
        try {
            const { projectId, sessionId } = req.params;
            const data = await analytics_service_1.AnalyticsService.getSessionDetails(projectId, sessionId);
            return res.status(200).json({
                status: 'success',
                message: 'Session details fetched successfully',
                data,
            });
        }
        catch (error) {
            return AnalyticsController.handleError(error, res, 'Failed to fetch session details');
        }
    }
    static async getSessionTimeline(req, res) {
        try {
            const { projectId, sessionId } = req.params;
            const data = await analytics_service_1.AnalyticsService.getSessionTimeline(projectId, sessionId);
            return res.status(200).json({
                status: 'success',
                message: 'Session timeline fetched successfully',
                data,
            });
        }
        catch (error) {
            return AnalyticsController.handleError(error, res, 'Failed to fetch session timeline');
        }
    }
    static async getSessionStats(req, res) {
        try {
            const { projectId } = req.params;
            const { timeRange = '24h' } = req.query;
            const data = await analytics_service_1.AnalyticsService.getSessionStats(projectId, {
                timeRange: timeRange,
            });
            return res.status(200).json({
                status: 'success',
                message: 'Session stats fetched successfully',
                data,
            });
        }
        catch (error) {
            return AnalyticsController.handleError(error, res, 'Failed to fetch session stats');
        }
    }
    static async getUserJourneys(req, res) {
        try {
            const { projectId } = req.params;
            const { timeRange = '7d', limit = '10' } = req.query;
            const data = await analytics_service_1.AnalyticsService.getUserJourneys(projectId, {
                timeRange: timeRange,
                limit: parseInt(limit),
            });
            return res.status(200).json({
                status: 'success',
                message: 'User journeys fetched successfully',
                data,
            });
        }
        catch (error) {
            return AnalyticsController.handleError(error, res, 'Failed to fetch user journeys');
        }
    }
    // ============================================================================
    // ENVIRONMENT ANALYTICS
    // ============================================================================
    static async getEnvironmentStats(req, res) {
        try {
            const { projectId } = req.params;
            const timeRange = req.query.timeRange || "7d";
            const data = await analytics_service_1.AnalyticsService.getEnvironmentStats(projectId, { timeRange });
            return res.status(200).json({
                status: "success",
                message: "Environment statistics retrieved",
                data,
                meta: { projectId, timeRange },
            });
        }
        catch (error) {
            return AnalyticsController.handleError(error, res, "Failed to fetch environment statistics");
        }
    }
    // ============================================================================
    // CROSS-DASHBOARD UTILITIES
    // ============================================================================
    static async getDashboardOverview(req, res) {
        try {
            const { projectId } = req.params;
            const { timeRange = '24h' } = req.query;
            const data = await analytics_service_1.AnalyticsService.getDashboardOverview(projectId, {
                timeRange: timeRange,
            });
            return res.status(200).json({
                status: 'success',
                message: 'Dashboard overview fetched successfully',
                data,
            });
        }
        catch (error) {
            return AnalyticsController.handleError(error, res, 'Failed to fetch dashboard overview');
        }
    }
    static async exportAnalytics(req, res) {
        try {
            const { projectId } = req.params;
            const { format = 'json', ...filters } = req.body;
            const data = await analytics_service_1.AnalyticsService.exportAnalytics(projectId, {
                format: format,
                ...filters,
            });
            const filename = `analytics-${projectId}-${Date.now()}.${format}`;
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
            return res.status(200).json({
                status: 'success',
                message: 'Analytics exported successfully',
                data,
                meta: { filename },
            });
        }
        catch (error) {
            return AnalyticsController.handleError(error, res, 'Failed to export analytics');
        }
    }
    static async getAlerts(req, res) {
        try {
            const { projectId } = req.params;
            const { severity, status } = req.query;
            const data = await analytics_service_1.AnalyticsService.getAlerts(projectId, {
                severity: severity,
                status: status,
            });
            return res.status(200).json({
                status: 'success',
                message: 'Alerts fetched successfully',
                data,
            });
        }
        catch (error) {
            return AnalyticsController.handleError(error, res, 'Failed to fetch alerts');
        }
    }
}
exports.AnalyticsController = AnalyticsController;
