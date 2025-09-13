"use strict";
// src/controllers/dashboard.controller.ts
// @ts-nocheck
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardValidation = exports.DashboardController = void 0;
const dashboard_service_1 = require("../services/dashboard.service");
const express_validator_1 = require("express-validator");
/**
 * DashboardController - Handles all dashboard-related HTTP requests
 *
 * This controller provides comprehensive dashboard functionality including:
 * - Dashboard metrics and analytics
 * - Real-time monitoring
 * - User analytics
 * - Error analysis
 * - Performance metrics
 * - Project health monitoring
 * - Data export capabilities
 * - Multi-user analytics (admin functions)
 */
class DashboardController {
    /**
     * Centralized error handler for consistent error responses
     * Maps service-level errors to appropriate HTTP status codes
     */
    static handleError(error, res, defaultMessage) {
        console.error(`DashboardController Error: ${error.message}`, error.stack);
        // Handle custom dashboard errors
        if (error instanceof dashboard_service_1.DashboardValidationError) {
            return res.status(400).json({
                status: "error",
                message: error.message,
                errors: [error.message],
            });
        }
        if (error instanceof dashboard_service_1.DashboardOperationError) {
            return res.status(500).json({
                status: "error",
                message: error.message,
                meta: error.context,
            });
        }
        // Handle database-specific errors
        if (error.name === "ValidationError") {
            const errors = Object.values(error.errors).map((err) => err.message);
            return res.status(400).json({
                status: "error",
                message: "Validation failed",
                errors: errors,
            });
        }
        if (error.name === "CastError") {
            return res.status(400).json({
                status: "error",
                message: "Invalid ID format or value",
            });
        }
        // Generic server error fallback
        return res.status(500).json({
            status: "error",
            message: defaultMessage,
        });
    }
    /**
     * Validates and normalizes dashboard filter parameters
     */
    static buildFiltersFromRequest(req) {
        const { startDate, endDate, environment, logLevels, eventTypes, services, specificProjectIds, } = req.query;
        // Default to last 24 hours if no time range provided
        const defaultEnd = new Date();
        const defaultStart = new Date(defaultEnd.getTime() - 24 * 60 * 60 * 1000);
        const timeRange = {
            start: startDate ? new Date(startDate) : defaultStart,
            end: endDate ? new Date(endDate) : defaultEnd,
        };
        return {
            userId: req.userId,
            timeRange,
            environment: environment
                ? Array.isArray(environment)
                    ? environment
                    : [environment]
                : undefined,
            logLevels: logLevels
                ? Array.isArray(logLevels)
                    ? logLevels
                    : [logLevels]
                : undefined,
            eventTypes: eventTypes
                ? Array.isArray(eventTypes)
                    ? eventTypes
                    : [eventTypes]
                : undefined,
            services: services
                ? Array.isArray(services)
                    ? services
                    : [services]
                : undefined,
            specificProjectIds: specificProjectIds
                ? Array.isArray(specificProjectIds)
                    ? specificProjectIds
                    : [specificProjectIds]
                : undefined,
        };
    }
    static buildFiltersFromBody(req) {
        const { timeRange, environment, logLevels, eventTypes, services, specificProjectIds, } = req.body;
        return {
            userId: req.userId,
            timeRange: {
                start: new Date(timeRange.start),
                end: new Date(timeRange.end),
            },
            environment,
            logLevels,
            eventTypes,
            services,
            specificProjectIds,
        };
    }
    // =============================================================================
    // CORE DASHBOARD METRICS
    // =============================================================================
    /**
     * Get comprehensive dashboard metrics
     * GET /api/dashboard/metrics
     */
    static async getMetrics(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    status: "error",
                    errors: errors.array().map((err) => err.msg),
                });
            }
            const filters = DashboardController.buildFiltersFromRequest(req);
            const metrics = await dashboard_service_1.DashboardService.getDashboardMetrics(filters);
            return res.status(200).json({
                status: "success",
                message: "Dashboard metrics fetched successfully",
                data: metrics,
                filters,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            return DashboardController.handleError(error, res, "Failed to fetch dashboard metrics");
        }
    }
    /**
     * Get real-time metrics for live dashboard
     * GET /api/dashboard/realtime
     */
    static async getRealTimeMetrics(req, res) {
        try {
            const { specificProjectIds } = req.query;
            const userId = req.userId;
            const projectIdArray = specificProjectIds
                ? Array.isArray(specificProjectIds)
                    ? specificProjectIds
                    : [specificProjectIds]
                : undefined;
            const metrics = await dashboard_service_1.DashboardService.getRealTimeMetrics(userId, projectIdArray);
            return res.status(200).json({
                status: "success",
                message: "Real-time metrics fetched successfully",
                data: metrics,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            return DashboardController.handleError(error, res, "Failed to fetch real-time metrics");
        }
    }
    /**
     * Get dashboard overview (summary of all key metrics)
     * GET /api/dashboard/overview
     */
    static async getOverview(req, res) {
        try {
            const filters = DashboardController.buildFiltersFromRequest(req);
            const [metrics, realTimeMetrics] = await Promise.all([
                dashboard_service_1.DashboardService.getDashboardMetrics(filters),
                dashboard_service_1.DashboardService.getRealTimeMetrics(filters.userId, filters.specificProjectIds),
            ]);
            const overview = {
                summary: {
                    totalLogs: metrics.totalLogs,
                    totalProjects: metrics.totalProjects,
                    totalErrors: metrics.totalErrors,
                    errorRate: metrics.averageErrorRate,
                    averageResponseTime: metrics.averageResponseTime,
                },
                realTime: {
                    currentRPS: realTimeMetrics.currentRPS,
                    currentErrorRate: realTimeMetrics.currentErrorRate,
                    activeUsers: realTimeMetrics.activeUsers,
                },
                health: {
                    healthyProjects: metrics.projectHealth.filter((p) => p.healthScore >= 80).length,
                    warningProjects: metrics.projectHealth.filter((p) => p.healthScore >= 60 && p.healthScore < 80).length,
                    criticalProjects: metrics.projectHealth.filter((p) => p.healthScore < 60).length,
                },
                topIssues: {
                    mostFrequentError: metrics.topErrors[0] || null,
                    slowestEndpoint: metrics.slowestEndpoints[0] || null,
                    recentCriticalErrors: realTimeMetrics.recentErrors
                        .filter((e) => e.severity === "fatal")
                        .slice(0, 3),
                },
                trends: {
                    logVolumeChange: DashboardController.calculateTrendChange(metrics.logsOverTime, "total"),
                    errorRateChange: DashboardController.calculateTrendChange(metrics.logsOverTime, "errors"),
                },
            };
            return res.status(200).json({
                status: "success",
                message: "Dashboard overview fetched successfully",
                data: overview,
                filters,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            return DashboardController.handleError(error, res, "Failed to fetch dashboard overview");
        }
    }
    // =============================================================================
    // SPECIALIZED ANALYTICS ENDPOINTS
    // =============================================================================
    /**
     * Get user analytics
     * GET /api/dashboard/analytics/users
     */
    static async getUserAnalytics(req, res) {
        try {
            const filters = DashboardController.buildFiltersFromRequest(req);
            const metrics = await dashboard_service_1.DashboardService.getDashboardMetrics(filters);
            const userAnalytics = {
                browserStats: metrics.browserStats,
                topErrors: metrics.topErrors.map((error) => ({
                    message: error.message,
                    affectedUsers: error.affectedUsers,
                    count: error.count,
                })),
                pageViews: metrics.pageLoadTimes.length,
                performanceImpact: {
                    slowPages: metrics.pageLoadTimes.filter((p) => p.averageTime > 3000)
                        .length,
                    totalPages: metrics.pageLoadTimes.length,
                },
            };
            return res.status(200).json({
                status: "success",
                message: "User analytics fetched successfully",
                data: userAnalytics,
                filters,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            return DashboardController.handleError(error, res, "Failed to fetch user analytics");
        }
    }
    /**
     * Get time series data
     * GET /api/dashboard/timeseries
     */
    static async getTimeSeriesData(req, res) {
        try {
            const filters = DashboardController.buildFiltersFromRequest(req);
            const metrics = await dashboard_service_1.DashboardService.getDashboardMetrics(filters);
            const timeSeriesData = {
                logsOverTime: metrics.logsOverTime,
                summary: {
                    totalDataPoints: metrics.logsOverTime.length,
                    peakTime: metrics.logsOverTime.reduce((peak, current) => (current.total > peak.total ? current : peak), { total: 0, timestamp: new Date() }),
                    averageLogsPerPeriod: metrics.logsOverTime.length > 0
                        ? metrics.logsOverTime.reduce((sum, point) => sum + point.total, 0) / metrics.logsOverTime.length
                        : 0,
                },
            };
            return res.status(200).json({
                status: "success",
                message: "Time series data fetched successfully",
                data: timeSeriesData,
                filters,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            return DashboardController.handleError(error, res, "Failed to fetch time series data");
        }
    }
    /**
     * Get error analysis
     * GET /api/dashboard/errors
     */
    static async getErrorAnalysis(req, res) {
        try {
            const filters = DashboardController.buildFiltersFromRequest(req);
            // Force error levels for this endpoint
            filters.logLevels = ["error", "fatal"];
            const metrics = await dashboard_service_1.DashboardService.getDashboardMetrics(filters);
            const errorAnalysis = {
                totalErrors: metrics.totalErrors,
                errorRate: metrics.averageErrorRate,
                errorsByType: metrics.errorsByType,
                topErrors: metrics.topErrors,
                errorTrend: metrics.logsOverTime.map((point) => ({
                    timestamp: point.timestamp,
                    errors: point.errors,
                })),
            };
            return res.status(200).json({
                status: "success",
                message: "Error analysis fetched successfully",
                data: errorAnalysis,
                filters,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            return DashboardController.handleError(error, res, "Failed to fetch error analysis");
        }
    }
    /**
     * Get performance metrics
     * GET /api/dashboard/performance
     */
    static async getPerformanceMetrics(req, res) {
        try {
            const filters = DashboardController.buildFiltersFromRequest(req);
            const metrics = await dashboard_service_1.DashboardService.getDashboardMetrics(filters);
            const performanceMetrics = {
                averageResponseTime: metrics.averageResponseTime,
                p95ResponseTime: metrics.p95ResponseTime,
                p99ResponseTime: metrics.p99ResponseTime,
                slowestEndpoints: metrics.slowestEndpoints,
                pageLoadTimes: metrics.pageLoadTimes,
                networkStats: metrics.networkStats,
            };
            return res.status(200).json({
                status: "success",
                message: "Performance metrics fetched successfully",
                data: performanceMetrics,
                filters,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            return DashboardController.handleError(error, res, "Failed to fetch performance metrics");
        }
    }
    /**
     * Get project health overview
     * GET /api/dashboard/projects/health
     */
    static async getProjectHealth(req, res) {
        try {
            const filters = DashboardController.buildFiltersFromRequest(req);
            const metrics = await dashboard_service_1.DashboardService.getDashboardMetrics(filters);
            const projectHealthData = {
                totalProjects: metrics.totalProjects,
                averageLogsPerProject: metrics.averageLogsPerProject,
                projectHealth: metrics.projectHealth,
                healthSummary: {
                    healthy: metrics.projectHealth.filter((p) => p.healthScore >= 80)
                        .length,
                    warning: metrics.projectHealth.filter((p) => p.healthScore >= 60 && p.healthScore < 80).length,
                    critical: metrics.projectHealth.filter((p) => p.healthScore < 60)
                        .length,
                },
            };
            return res.status(200).json({
                status: "success",
                message: "Project health data fetched successfully",
                data: projectHealthData,
                filters,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            return DashboardController.handleError(error, res, "Failed to fetch project health");
        }
    }
    /**
     * Get alerts and notifications
     * GET /api/dashboard/alerts
     */
    static async getAlerts(req, res) {
        try {
            const filters = DashboardController.buildFiltersFromRequest(req);
            const [metrics, realTimeMetrics] = await Promise.all([
                dashboard_service_1.DashboardService.getDashboardMetrics(filters),
                dashboard_service_1.DashboardService.getRealTimeMetrics(filters.userId, filters.specificProjectIds),
            ]);
            const alerts = [];
            // High error rate alert
            if (metrics.averageErrorRate > 10) {
                alerts.push({
                    type: "critical",
                    title: "High Error Rate Detected",
                    message: `Current error rate is ${metrics.averageErrorRate.toFixed(2)}% (threshold: 10%)`,
                    timestamp: new Date(),
                    metadata: { errorRate: metrics.averageErrorRate },
                });
            }
            // Slow response time alert
            if (metrics.averageResponseTime > 3000) {
                alerts.push({
                    type: "warning",
                    title: "Slow Response Times",
                    message: `Average response time is ${metrics.averageResponseTime.toFixed(0)}ms (threshold: 3000ms)`,
                    timestamp: new Date(),
                    metadata: { responseTime: metrics.averageResponseTime },
                });
            }
            // Recent fatal errors
            realTimeMetrics.recentErrors
                .filter((error) => error.severity === "fatal")
                .forEach((error) => {
                alerts.push({
                    type: "critical",
                    title: "Fatal Error Detected",
                    message: error.message,
                    timestamp: error.timestamp,
                    metadata: { projectId: error.projectId, severity: error.severity },
                });
            });
            // Unhealthy projects
            metrics.projectHealth
                .filter((project) => project.healthScore < 60)
                .forEach((project) => {
                alerts.push({
                    type: "warning",
                    title: "Unhealthy Project",
                    message: `Project "${project.projectName}" has low health score: ${project.healthScore}/100`,
                    timestamp: new Date(),
                    metadata: {
                        projectId: project.projectId,
                        healthScore: project.healthScore,
                    },
                });
            });
            // Sort alerts by severity and timestamp
            alerts.sort((a, b) => {
                const severityOrder = { critical: 3, warning: 2, info: 1 };
                const severityDiff = (severityOrder[b.type] || 0) -
                    (severityOrder[a.type] || 0);
                if (severityDiff !== 0)
                    return severityDiff;
                return (new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            });
            return res.status(200).json({
                status: "success",
                message: "Alerts fetched successfully",
                data: {
                    alerts: alerts.slice(0, 20), // Limit to 20 most important alerts
                    summary: {
                        critical: alerts.filter((a) => a.type === "critical").length,
                        warning: alerts.filter((a) => a.type === "warning").length,
                        info: alerts.filter((a) => a.type === "info").length,
                    },
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            return DashboardController.handleError(error, res, "Failed to fetch alerts");
        }
    }
    // =============================================================================
    // DATA EXPORT AND IMPORT
    // =============================================================================
    /**
     * Export dashboard data
     * POST /api/dashboard/export
     */
    static async exportData(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    status: "error",
                    errors: errors.array().map((err) => err.msg),
                });
            }
            const filters = DashboardController.buildFiltersFromBody(req);
            const { format = "json" } = req.body;
            const exportData = await dashboard_service_1.DashboardService.exportDashboardData(filters);
            // Set appropriate headers for file download
            const timestamp = new Date().toISOString().split("T")[0];
            const filename = `dashboard-export-${timestamp}.${format}`;
            if (format === "csv") {
                res.setHeader("Content-Type", "text/csv");
                res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
                return res.send(DashboardController.convertToCSV(exportData));
            }
            else {
                res.setHeader("Content-Type", "application/json");
                res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
                return res.status(200).json({
                    status: "success",
                    message: "Dashboard data exported successfully",
                    data: exportData,
                    meta: {
                        filename,
                        exportedAt: new Date(),
                        format,
                    },
                    timestamp: new Date().toISOString(),
                });
            }
        }
        catch (error) {
            return DashboardController.handleError(error, res, "Failed to export dashboard data");
        }
    }
    // =============================================================================
    // USER PROJECT MANAGEMENT
    // =============================================================================
    /**
     * Get user's project list with basic health info
     * GET /api/dashboard/projects
     */
    static async getUserProjects(req, res) {
        try {
            const userId = req.userId;
            const projectList = await dashboard_service_1.DashboardService.getUserProjectList(userId);
            return res.status(200).json({
                status: "success",
                message: "User projects fetched successfully",
                data: projectList,
                meta: {
                    totalProjects: projectList.length,
                    activeProjects: projectList.filter((p) => p.isActive).length,
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            return DashboardController.handleError(error, res, "Failed to fetch user projects");
        }
    }
    // =============================================================================
    // ADMIN FUNCTIONS - MULTI-USER ANALYTICS
    // =============================================================================
    /**
     * Get dashboard metrics for multiple users (admin function)
     * POST /api/dashboard/admin/multi-user-metrics
     *
     * Body: { userIds: string[], filters: { timeRange, environment?, logLevels? } }
     */
    static async getMultiUserMetrics(req, res) {
        try {
            const { userIds, filters } = req.body;
            if (!Array.isArray(userIds) || userIds.length === 0) {
                return res.status(400).json({
                    status: "error",
                    message: "Array of user IDs is required",
                });
            }
            if (userIds.length > 100) {
                return res.status(400).json({
                    status: "error",
                    message: "Cannot analyze more than 100 users at once",
                });
            }
            if (!filters || !filters.timeRange) {
                return res.status(400).json({
                    status: "error",
                    message: "Filters with timeRange are required",
                });
            }
            const normalizedFilters = {
                timeRange: {
                    start: new Date(filters.timeRange.start),
                    end: new Date(filters.timeRange.end),
                },
                environment: filters.environment,
                logLevels: filters.logLevels,
            };
            const multiUserMetrics = await dashboard_service_1.DashboardService.getMultiUserMetrics(userIds, normalizedFilters);
            return res.status(200).json({
                status: "success",
                message: "Multi-user metrics fetched successfully",
                data: multiUserMetrics,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            return DashboardController.handleError(error, res, "Failed to fetch multi-user metrics");
        }
    }
    // =============================================================================
    // HEALTH CHECK
    // =============================================================================
    /**
     * Dashboard service health check
     * GET /api/dashboard/health
     */
    static async healthCheck(req, res) {
        try {
            const healthStatus = await dashboard_service_1.DashboardService.healthCheck();
            if (healthStatus.status === "healthy") {
                return res.status(200).json({
                    status: "success",
                    message: "Dashboard service is healthy",
                    data: healthStatus.metrics,
                });
            }
            else {
                return res.status(503).json({
                    status: "error",
                    message: "Dashboard service is unhealthy",
                    errors: [healthStatus.error || "Unknown health issue"],
                    data: healthStatus.metrics,
                });
            }
        }
        catch (error) {
            return res.status(500).json({
                status: "error",
                message: "Failed to perform health check due to an unexpected error",
                errors: [error.message],
            });
        }
    }
    // =============================================================================
    // HELPER METHODS
    // =============================================================================
    static convertToCSV(data) {
        // Simple CSV conversion - in production, use a proper CSV library like csv-writer
        if (!data.metrics) {
            return "No metrics data available";
        }
        const headers = Object.keys(data.metrics);
        const csvRows = [headers.join(",")];
        // This is a simplified version - you'd want more sophisticated CSV export
        csvRows.push(headers
            .map((header) => {
            const value = data.metrics[header];
            if (typeof value === "object") {
                return JSON.stringify(value);
            }
            return value;
        })
            .join(","));
        return csvRows.join("\n");
    }
    static calculateTrendChange(timeSeriesData, field) {
        if (timeSeriesData.length < 2)
            return 0;
        const recent = timeSeriesData
            .slice(-3)
            .reduce((sum, item) => sum + (item[field] || 0), 0) / 3;
        const previous = timeSeriesData
            .slice(0, 3)
            .reduce((sum, item) => sum + (item[field] || 0), 0) / 3;
        if (previous === 0)
            return 0;
        return ((recent - previous) / previous) * 100;
    }
}
exports.DashboardController = DashboardController;
// =============================================================================
// VALIDATION MIDDLEWARE
// =============================================================================
exports.dashboardValidation = {
    metrics: [
        (0, express_validator_1.query)("startDate")
            .optional()
            .isISO8601()
            .withMessage("Invalid start date format"),
        (0, express_validator_1.query)("endDate")
            .optional()
            .isISO8601()
            .withMessage("Invalid end date format"),
        (0, express_validator_1.query)("specificProjectIds")
            .optional()
            .custom((value) => {
            if (typeof value === "string")
                return true;
            if (Array.isArray(value))
                return true;
            throw new Error("Specific project IDs must be a string or array");
        }),
        (0, express_validator_1.query)("environment").optional(),
        (0, express_validator_1.query)("logLevels").optional(),
        (0, express_validator_1.query)("eventTypes").optional(),
        (0, express_validator_1.query)("services").optional(),
    ],
    export: [
        (0, express_validator_1.body)("timeRange.start")
            .isISO8601()
            .withMessage("Invalid start date format"),
        (0, express_validator_1.body)("timeRange.end").isISO8601().withMessage("Invalid end date format"),
        (0, express_validator_1.body)("format")
            .optional()
            .isIn(["json", "csv"])
            .withMessage("Format must be json or csv"),
        (0, express_validator_1.body)("specificProjectIds")
            .optional()
            .custom((value) => {
            if (!value)
                return true;
            if (Array.isArray(value))
                return true;
            throw new Error("Specific project IDs must be an array");
        }),
    ],
    multiUserMetrics: [
        (0, express_validator_1.body)("userIds")
            .isArray({ min: 1, max: 100 })
            .withMessage("User IDs must be an array with 1-100 items"),
        (0, express_validator_1.body)("userIds.*")
            .isMongoId()
            .withMessage("Each user ID must be a valid MongoDB ObjectId"),
        (0, express_validator_1.body)("filters.timeRange.start")
            .isISO8601()
            .withMessage("Invalid start date format"),
        (0, express_validator_1.body)("filters.timeRange.end")
            .isISO8601()
            .withMessage("Invalid end date format"),
        (0, express_validator_1.body)("filters.environment")
            .optional()
            .isArray()
            .withMessage("Environment must be an array"),
        (0, express_validator_1.body)("filters.logLevels")
            .optional()
            .isArray()
            .withMessage("Log levels must be an array"),
    ],
};
exports.default = DashboardController;
