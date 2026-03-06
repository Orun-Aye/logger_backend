// src/controllers/dashboard.controller.ts

import { Request, Response } from "express";
import {
  DashboardService,
  DashboardValidationError,
  DashboardOperationError,
  DashboardFiltersWithUser,
} from "../services/dashboard.service";
import { body, query, validationResult } from "express-validator";

/**
 * Response interface for consistent API responses
 */
interface ApiResponse<T = any> {
  status: "success" | "error";
  message?: string;
  data?: T;
  errors?: string[];
  meta?: any;
  filters?: DashboardFiltersWithUser;
  timestamp?: string;
}

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
export class DashboardController {
  /**
   * Centralized error handler for consistent error responses
   * Maps service-level errors to appropriate HTTP status codes
   */
  private static handleError(
    error: Error,
    res: Response,
    defaultMessage: string
  ): Response {
    console.error(`DashboardController Error: ${error.message}`, error.stack);

    // Handle custom dashboard errors
    if (error instanceof DashboardValidationError) {
      return res.status(400).json({
        status: "error",
        message: error.message,
        errors: [error.message],
      } as ApiResponse);
    }

    if (error instanceof DashboardOperationError) {
      return res.status(500).json({
        status: "error",
        message: error.message,
        meta: error.context,
      } as ApiResponse);
    }

    // Handle database-specific errors
    if (error.name === "ValidationError") {
      const errors = Object.values((error as any).errors).map(
        (err: any) => err.message
      );
      return res.status(400).json({
        status: "error",
        message: "Validation failed",
        errors: errors,
      } as ApiResponse);
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        status: "error",
        message: "Invalid ID format or value",
      } as ApiResponse);
    }

    // Generic server error fallback
    return res.status(500).json({
      status: "error",
      message: defaultMessage,
    } as ApiResponse);
  }

  /**
   * Validates and normalizes dashboard filter parameters
   */
  private static buildFiltersFromRequest(
    req: Request
  ): DashboardFiltersWithUser {
    const {
      startDate,
      endDate,
      environment,
      logLevels,
      eventTypes,
      services,
      specificProjectIds,
    } = req.query;

    // Default to last 24 hours if no time range provided
    const defaultEnd = new Date();
    const defaultStart = new Date(defaultEnd.getTime() - 24 * 60 * 60 * 1000);

    const timeRange = {
      start: startDate ? new Date(startDate as string) : defaultStart,
      end: endDate ? new Date(endDate as string) : defaultEnd,
    };

    return {
      userId: req.userId!,
      timeRange,
      environment: environment
        ? Array.isArray(environment)
          ? (environment as string[])
          : [environment as string]
        : undefined,
      logLevels: logLevels
        ? Array.isArray(logLevels)
          ? (logLevels as string[])
          : [logLevels as string]
        : undefined,
      eventTypes: eventTypes
        ? Array.isArray(eventTypes)
          ? (eventTypes as string[])
          : [eventTypes as string]
        : undefined,
      services: services
        ? Array.isArray(services)
          ? (services as string[])
          : [services as string]
        : undefined,
      specificProjectIds: specificProjectIds
        ? Array.isArray(specificProjectIds)
          ? (specificProjectIds as string[])
          : [specificProjectIds as string]
        : undefined,
    };
  }

  private static buildFiltersFromBody(req: Request): DashboardFiltersWithUser {
    const {
      timeRange,
      environment,
      logLevels,
      eventTypes,
      services,
      specificProjectIds,
    } = req.body;

    return {
      userId: req.userId!,
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
  static async getMetrics(req: Request, res: Response): Promise<Response> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: "error",
          errors: errors.array().map((err) => err.msg),
        } as ApiResponse);
      }

      const filters = DashboardController.buildFiltersFromRequest(req);
      const metrics = await DashboardService.getDashboardMetrics(filters);

      return res.status(200).json({
        status: "success",
        message: "Dashboard metrics fetched successfully",
        data: metrics,
        filters,
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    } catch (error) {
      return DashboardController.handleError(
        error as Error,
        res,
        "Failed to fetch dashboard metrics"
      );
    }
  }

  /**
   * Get real-time metrics for live dashboard
   * GET /api/dashboard/realtime
   */
  static async getRealTimeMetrics(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const { specificProjectIds } = req.query;
      const userId = req.userId!;

      const projectIdArray = specificProjectIds
        ? Array.isArray(specificProjectIds)
          ? (specificProjectIds as string[])
          : [specificProjectIds as string]
        : undefined;

      const metrics = await DashboardService.getRealTimeMetrics(
        userId,
        projectIdArray
      );

      return res.status(200).json({
        status: "success",
        message: "Real-time metrics fetched successfully",
        data: metrics,
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    } catch (error) {
      return DashboardController.handleError(
        error as Error,
        res,
        "Failed to fetch real-time metrics"
      );
    }
  }

  /**
   * Get dashboard overview (summary of all key metrics)
   * GET /api/dashboard/overview
   *
   * Query params:
   *   includeComparison=true  — adds period-over-period comparison + sparklines
   */
  static async getOverview(req: Request, res: Response): Promise<Response> {
    try {
      const filters = DashboardController.buildFiltersFromRequest(req);
      const includeComparison = req.query.includeComparison === "true";

      // When comparison requested, use the richer method that runs both periods
      if (includeComparison) {
        const [comparisonResult, realTimeMetrics] = await Promise.all([
          DashboardService.getDashboardMetricsWithComparison(filters),
          DashboardService.getRealTimeMetrics(
            filters.userId,
            filters.specificProjectIds
          ),
        ]);

        const metrics = comparisonResult.current;

        const overview = {
          summary: {
            totalLogs: metrics.totalLogs,
            totalProjects: metrics.totalProjects,
            totalErrors: metrics.totalErrors,
            totalWarnings: metrics.totalWarnings,
            errorRate: metrics.averageErrorRate,
            averageResponseTime: metrics.averageResponseTime,
          },
          realTime: {
            currentRPS: realTimeMetrics.currentRPS,
            currentErrorRate: realTimeMetrics.currentErrorRate,
            activeUsers: realTimeMetrics.activeUsers,
          },
          health: {
            healthyProjects: metrics.projectHealth.filter(
              (p) => p.healthScore >= 80
            ).length,
            warningProjects: metrics.projectHealth.filter(
              (p) => p.healthScore >= 60 && p.healthScore < 80
            ).length,
            criticalProjects: metrics.projectHealth.filter(
              (p) => p.healthScore < 60
            ).length,
          },
          topIssues: {
            mostFrequentError: metrics.topErrors[0] || null,
            slowestEndpoint: metrics.slowestEndpoints[0] || null,
            recentCriticalErrors: realTimeMetrics.recentErrors
              .filter((e) => e.severity === "fatal")
              .slice(0, 3),
          },
          trends: {
            logVolumeChange: comparisonResult.comparison.totalLogs.change,
            errorRateChange: comparisonResult.comparison.errorRate.change,
          },
          comparison: comparisonResult.comparison,
          sparklines: comparisonResult.sparklines,
          logsOverTime: metrics.logsOverTime,
          networkStats: metrics.networkStats,
          pageLoadTimes: metrics.pageLoadTimes,
          browserStats: metrics.browserStats,
          topErrors: metrics.topErrors,
          slowestEndpoints: metrics.slowestEndpoints,
          errorsByType: metrics.errorsByType,
          projectHealth: metrics.projectHealth,
        };

        return res.status(200).json({
          status: "success",
          message: "Dashboard overview fetched successfully",
          data: overview,
          filters,
          timestamp: new Date().toISOString(),
        } as ApiResponse);
      }

      // Legacy path (no comparison) — kept for backward compatibility
      const [metrics, realTimeMetrics] = await Promise.all([
        DashboardService.getDashboardMetrics(filters),
        DashboardService.getRealTimeMetrics(
          filters.userId,
          filters.specificProjectIds
        ),
      ]);

      const overview = {
        summary: {
          totalLogs: metrics.totalLogs,
          totalProjects: metrics.totalProjects,
          totalErrors: metrics.totalErrors,
          totalWarnings: metrics.totalWarnings,
          errorRate: metrics.averageErrorRate,
          averageResponseTime: metrics.averageResponseTime,
        },
        realTime: {
          currentRPS: realTimeMetrics.currentRPS,
          currentErrorRate: realTimeMetrics.currentErrorRate,
          activeUsers: realTimeMetrics.activeUsers,
        },
        health: {
          healthyProjects: metrics.projectHealth.filter(
            (p) => p.healthScore >= 80
          ).length,
          warningProjects: metrics.projectHealth.filter(
            (p) => p.healthScore >= 60 && p.healthScore < 80
          ).length,
          criticalProjects: metrics.projectHealth.filter(
            (p) => p.healthScore < 60
          ).length,
        },
        topIssues: {
          mostFrequentError: metrics.topErrors[0] || null,
          slowestEndpoint: metrics.slowestEndpoints[0] || null,
          recentCriticalErrors: realTimeMetrics.recentErrors
            .filter((e) => e.severity === "fatal")
            .slice(0, 3),
        },
        trends: {
          logVolumeChange: 0,
          errorRateChange: 0,
        },
        logsOverTime: metrics.logsOverTime,
        networkStats: metrics.networkStats,
        pageLoadTimes: metrics.pageLoadTimes,
        browserStats: metrics.browserStats,
        topErrors: metrics.topErrors,
        slowestEndpoints: metrics.slowestEndpoints,
        errorsByType: metrics.errorsByType,
        projectHealth: metrics.projectHealth,
      };

      return res.status(200).json({
        status: "success",
        message: "Dashboard overview fetched successfully",
        data: overview,
        filters,
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    } catch (error) {
      return DashboardController.handleError(
        error as Error,
        res,
        "Failed to fetch dashboard overview"
      );
    }
  }

  // =============================================================================
  // SPECIALIZED ANALYTICS ENDPOINTS
  // =============================================================================

  /**
   * Get user analytics
   * GET /api/dashboard/analytics/users
   */
  static async getUserAnalytics(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const filters = DashboardController.buildFiltersFromRequest(req);
      const metrics = await DashboardService.getDashboardMetrics(filters);

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
      } as ApiResponse);
    } catch (error) {
      return DashboardController.handleError(
        error as Error,
        res,
        "Failed to fetch user analytics"
      );
    }
  }

  /**
   * Get time series data
   * GET /api/dashboard/timeseries
   */
  static async getTimeSeriesData(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const filters = DashboardController.buildFiltersFromRequest(req);
      const metrics = await DashboardService.getDashboardMetrics(filters);

      const timeSeriesData = {
        logsOverTime: metrics.logsOverTime,
        summary: {
          totalDataPoints: metrics.logsOverTime.length,
          peakTime: metrics.logsOverTime.reduce(
            (peak, current) => (current.total > peak.total ? current : peak),
            { total: 0, timestamp: new Date() }
          ),
          averageLogsPerPeriod:
            metrics.logsOverTime.length > 0
              ? metrics.logsOverTime.reduce(
                  (sum, point) => sum + point.total,
                  0
                ) / metrics.logsOverTime.length
              : 0,
        },
      };

      return res.status(200).json({
        status: "success",
        message: "Time series data fetched successfully",
        data: timeSeriesData,
        filters,
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    } catch (error) {
      return DashboardController.handleError(
        error as Error,
        res,
        "Failed to fetch time series data"
      );
    }
  }

  /**
   * Get error analysis
   * GET /api/dashboard/errors
   */
  static async getErrorAnalysis(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const filters = DashboardController.buildFiltersFromRequest(req);
      // Force error levels for this endpoint
      filters.logLevels = ["error", "fatal"];

      const metrics = await DashboardService.getDashboardMetrics(filters);

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
      } as ApiResponse);
    } catch (error) {
      return DashboardController.handleError(
        error as Error,
        res,
        "Failed to fetch error analysis"
      );
    }
  }

  /**
   * Get performance metrics
   * GET /api/dashboard/performance
   */
  static async getPerformanceMetrics(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const filters = DashboardController.buildFiltersFromRequest(req);
      const metrics = await DashboardService.getDashboardMetrics(filters);

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
      } as ApiResponse);
    } catch (error) {
      return DashboardController.handleError(
        error as Error,
        res,
        "Failed to fetch performance metrics"
      );
    }
  }

  /**
   * Get project health overview
   * GET /api/dashboard/projects/health
   */
  static async getProjectHealth(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const filters = DashboardController.buildFiltersFromRequest(req);
      const metrics = await DashboardService.getDashboardMetrics(filters);

      const projectHealthData = {
        totalProjects: metrics.totalProjects,
        averageLogsPerProject: metrics.averageLogsPerProject,
        projectHealth: metrics.projectHealth,
        healthSummary: {
          healthy: metrics.projectHealth.filter((p) => p.healthScore >= 80)
            .length,
          warning: metrics.projectHealth.filter(
            (p) => p.healthScore >= 60 && p.healthScore < 80
          ).length,
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
      } as ApiResponse);
    } catch (error) {
      return DashboardController.handleError(
        error as Error,
        res,
        "Failed to fetch project health"
      );
    }
  }

  /**
   * Get alerts and notifications
   * GET /api/dashboard/alerts
   */
  static async getAlerts(req: Request, res: Response): Promise<Response> {
    try {
      const filters = DashboardController.buildFiltersFromRequest(req);
      const [metrics, realTimeMetrics] = await Promise.all([
        DashboardService.getDashboardMetrics(filters),
        DashboardService.getRealTimeMetrics(
          filters.userId,
          filters.specificProjectIds
        ),
      ]);

      const alerts = [];

      // High error rate alert
      if (metrics.averageErrorRate > 10) {
        alerts.push({
          type: "critical",
          title: "High Error Rate Detected",
          message: `Current error rate is ${metrics.averageErrorRate.toFixed(
            2
          )}% (threshold: 10%)`,
          timestamp: new Date(),
          metadata: { errorRate: metrics.averageErrorRate },
        });
      }

      // Slow response time alert
      if (metrics.averageResponseTime > 3000) {
        alerts.push({
          type: "warning",
          title: "Slow Response Times",
          message: `Average response time is ${metrics.averageResponseTime.toFixed(
            0
          )}ms (threshold: 3000ms)`,
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
        const severityDiff =
          (severityOrder[b.type as keyof typeof severityOrder] || 0) -
          (severityOrder[a.type as keyof typeof severityOrder] || 0);
        if (severityDiff !== 0) return severityDiff;
        return (
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
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
      } as ApiResponse);
    } catch (error) {
      return DashboardController.handleError(
        error as Error,
        res,
        "Failed to fetch alerts"
      );
    }
  }

  // =============================================================================
  // DATA EXPORT AND IMPORT
  // =============================================================================

  /**
   * Export dashboard data
   * POST /api/dashboard/export
   */
  static async exportData(req: Request, res: Response): Promise<Response> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: "error",
          errors: errors.array().map((err) => err.msg),
        } as ApiResponse);
      }

      const filters = DashboardController.buildFiltersFromBody(req);
      const { format = "json" } = req.body;

      const exportData = await DashboardService.exportDashboardData(filters);

      // Set appropriate headers for file download
      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `dashboard-export-${timestamp}.${format}`;

      if (format === "csv") {
        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}"`
        );
        return res.send(DashboardController.convertToCSV(exportData));
      } else {
        res.setHeader("Content-Type", "application/json");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}"`
        );
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
        } as ApiResponse);
      }
    } catch (error) {
      return DashboardController.handleError(
        error as Error,
        res,
        "Failed to export dashboard data"
      );
    }
  }

  // =============================================================================
  // USER PROJECT MANAGEMENT
  // =============================================================================

  /**
   * Get user's project list with basic health info
   * GET /api/dashboard/projects
   */
  static async getUserProjects(req: Request, res: Response): Promise<Response> {
    try {
      const userId = req.userId!;
      const projectList = await DashboardService.getUserProjectList(userId);

      return res.status(200).json({
        status: "success",
        message: "User projects fetched successfully",
        data: projectList,
        meta: {
          totalProjects: projectList.length,
          activeProjects: projectList.filter((p) => p.isActive).length,
        },
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    } catch (error) {
      return DashboardController.handleError(
        error as Error,
        res,
        "Failed to fetch user projects"
      );
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
  static async getMultiUserMetrics(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const { userIds, filters } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({
          status: "error",
          message: "Array of user IDs is required",
        } as ApiResponse);
      }

      if (userIds.length > 100) {
        return res.status(400).json({
          status: "error",
          message: "Cannot analyze more than 100 users at once",
        } as ApiResponse);
      }

      if (!filters || !filters.timeRange) {
        return res.status(400).json({
          status: "error",
          message: "Filters with timeRange are required",
        } as ApiResponse);
      }

      const normalizedFilters = {
        timeRange: {
          start: new Date(filters.timeRange.start),
          end: new Date(filters.timeRange.end),
        },
        environment: filters.environment,
        logLevels: filters.logLevels,
      };

      const multiUserMetrics = await DashboardService.getMultiUserMetrics(
        userIds,
        normalizedFilters
      );

      return res.status(200).json({
        status: "success",
        message: "Multi-user metrics fetched successfully",
        data: multiUserMetrics,
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    } catch (error) {
      return DashboardController.handleError(
        error as Error,
        res,
        "Failed to fetch multi-user metrics"
      );
    }
  }

  // =============================================================================
  // HEALTH CHECK
  // =============================================================================

  /**
   * Dashboard service health check
   * GET /api/dashboard/health
   */
  static async healthCheck(req: Request, res: Response): Promise<Response> {
    try {
      const healthStatus = await DashboardService.healthCheck();

      if (healthStatus.status === "healthy") {
        return res.status(200).json({
          status: "success",
          message: "Dashboard service is healthy",
          data: healthStatus.metrics,
        } as ApiResponse);
      } else {
        return res.status(503).json({
          status: "error",
          message: "Dashboard service is unhealthy",
          errors: [healthStatus.error || "Unknown health issue"],
          data: healthStatus.metrics,
        } as ApiResponse);
      }
    } catch (error) {
      return res.status(500).json({
        status: "error",
        message: "Failed to perform health check due to an unexpected error",
        errors: [(error as Error).message],
      } as ApiResponse);
    }
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  private static convertToCSV(data: any): string {
    // Simple CSV conversion - in production, use a proper CSV library like csv-writer
    if (!data.metrics) {
      return "No metrics data available";
    }

    const headers = Object.keys(data.metrics);
    const csvRows = [headers.join(",")];

    // This is a simplified version - you'd want more sophisticated CSV export
    csvRows.push(
      headers
        .map((header) => {
          const value = data.metrics[header];
          if (typeof value === "object") {
            return JSON.stringify(value);
          }
          return value;
        })
        .join(",")
    );

    return csvRows.join("\n");
  }

}

// =============================================================================
// VALIDATION MIDDLEWARE
// =============================================================================

export const dashboardValidation = {
  metrics: [
    query("startDate")
      .optional()
      .isISO8601()
      .withMessage("Invalid start date format"),
    query("endDate")
      .optional()
      .isISO8601()
      .withMessage("Invalid end date format"),
    query("specificProjectIds")
      .optional()
      .custom((value) => {
        if (typeof value === "string") return true;
        if (Array.isArray(value)) return true;
        throw new Error("Specific project IDs must be a string or array");
      }),
    query("environment").optional(),
    query("logLevels").optional(),
    query("eventTypes").optional(),
    query("services").optional(),
  ],

  export: [
    body("timeRange.start")
      .isISO8601()
      .withMessage("Invalid start date format"),
    body("timeRange.end").isISO8601().withMessage("Invalid end date format"),
    body("format")
      .optional()
      .isIn(["json", "csv"])
      .withMessage("Format must be json or csv"),
    body("specificProjectIds")
      .optional()
      .custom((value) => {
        if (!value) return true;
        if (Array.isArray(value)) return true;
        throw new Error("Specific project IDs must be an array");
      }),
  ],

  multiUserMetrics: [
    body("userIds")
      .isArray({ min: 1, max: 100 })
      .withMessage("User IDs must be an array with 1-100 items"),
    body("userIds.*")
      .isMongoId()
      .withMessage("Each user ID must be a valid MongoDB ObjectId"),
    body("filters.timeRange.start")
      .isISO8601()
      .withMessage("Invalid start date format"),
    body("filters.timeRange.end")
      .isISO8601()
      .withMessage("Invalid end date format"),
    body("filters.environment")
      .optional()
      .isArray()
      .withMessage("Environment must be an array"),
    body("filters.logLevels")
      .optional()
      .isArray()
      .withMessage("Log levels must be an array"),
  ],
};

export default DashboardController;
