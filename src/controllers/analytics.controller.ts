// src/controllers/analytics.controller.ts
import { Request, Response } from 'express';
import { AnalyticsService } from '../services/analytics.service';

interface ApiResponse<T = any> {
  status: 'success' | 'error';
  message?: string;
  data?: T;
  meta?: any;
}

export class AnalyticsController {
  private static handleError(error: Error, res: Response, defaultMessage: string): Response {
    console.error(`AnalyticsController Error: ${error.message}`, error.stack);
    
    return res.status(500).json({
      status: 'error',
      message: defaultMessage,
      errors: [error.message],
    } as ApiResponse);
  }

  // ============================================================================
  // ERROR ANALYTICS
  // ============================================================================

  static async getErrorTimeline(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { timeRange = '24h', granularity = 'hour' } = req.query;

      const data = await AnalyticsService.getErrorTimeline(projectId, {
        timeRange: timeRange as string,
        granularity: granularity as 'hour' | 'day',
      });

      return res.status(200).json({
        status: 'success',
        message: 'Error timeline fetched successfully',
        data,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to fetch error timeline');
    }
  }

  static async getTopErrors(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { limit = '10', timeRange = '24h' } = req.query;

      const data = await AnalyticsService.getTopErrors(projectId, {
        limit: parseInt(limit as string),
        timeRange: timeRange as string,
      });

      return res.status(200).json({
        status: 'success',
        message: 'Top errors fetched successfully',
        data,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to fetch top errors');
    }
  }

  static async getErrorDistribution(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { timeRange = '24h' } = req.query;

      const data = await AnalyticsService.getErrorDistribution(projectId, {
        timeRange: timeRange as string,
      });

      return res.status(200).json({
        status: 'success',
        message: 'Error distribution fetched successfully',
        data,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to fetch error distribution');
    }
  }

  static async getErrorStats(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { timeRange = '24h' } = req.query;

      const data = await AnalyticsService.getErrorStats(projectId, {
        timeRange: timeRange as string,
      });

      return res.status(200).json({
        status: 'success',
        message: 'Error stats fetched successfully',
        data,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to fetch error stats');
    }
  }

  static async getErrorDetails(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId, errorId } = req.params;

      const data = await AnalyticsService.getErrorDetails(projectId, errorId);

      return res.status(200).json({
        status: 'success',
        message: 'Error details fetched successfully',
        data,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to fetch error details');
    }
  }

  static async getErrorTrends(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { timeRange = '7d', groupBy = 'day' } = req.query;

      const data = await AnalyticsService.getErrorTrends(projectId, {
        timeRange: timeRange as string,
        groupBy: groupBy as 'hour' | 'day' | 'week',
      });

      return res.status(200).json({
        status: 'success',
        message: 'Error trends fetched successfully',
        data,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to fetch error trends');
    }
  }

  // ============================================================================
  // PERFORMANCE ANALYTICS
  // ============================================================================

  static async getPerformanceTimeline(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { timeRange = '24h', metric = 'all' } = req.query;

      const data = await AnalyticsService.getPerformanceTimeline(projectId, {
        timeRange: timeRange as string,
        metric: metric as string,
      });

      return res.status(200).json({
        status: 'success',
        message: 'Performance timeline fetched successfully',
        data,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to fetch performance timeline');
    }
  }

  static async getWebVitals(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { timeRange = '24h' } = req.query;

      const data = await AnalyticsService.getWebVitals(projectId, {
        timeRange: timeRange as string,
      });

      return res.status(200).json({
        status: 'success',
        message: 'Web Vitals fetched successfully',
        data,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to fetch Web Vitals');
    }
  }

  static async getResourcePerformance(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { timeRange = '24h', limit = '10' } = req.query;

      const data = await AnalyticsService.getResourcePerformance(projectId, {
        timeRange: timeRange as string,
        limit: parseInt(limit as string),
      });

      return res.status(200).json({
        status: 'success',
        message: 'Resource performance fetched successfully',
        data,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to fetch resource performance');
    }
  }

  static async getPagePerformance(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { timeRange = '24h', limit = '10' } = req.query;

      const data = await AnalyticsService.getPagePerformance(projectId, {
        timeRange: timeRange as string,
        limit: parseInt(limit as string),
      });

      return res.status(200).json({
        status: 'success',
        message: 'Page performance fetched successfully',
        data,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to fetch page performance');
    }
  }

  static async getPerformanceScore(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { timeRange = '24h' } = req.query;

      const data = await AnalyticsService.getPerformanceScore(projectId, {
        timeRange: timeRange as string,
      });

      return res.status(200).json({
        status: 'success',
        message: 'Performance score fetched successfully',
        data,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to fetch performance score');
    }
  }

  static async getSlowestEndpoints(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { timeRange = '24h', limit = '10' } = req.query;

      const data = await AnalyticsService.getSlowestEndpoints(projectId, {
        timeRange: timeRange as string,
        limit: parseInt(limit as string),
      });

      return res.status(200).json({
        status: 'success',
        message: 'Slowest endpoints fetched successfully',
        data,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to fetch slowest endpoints');
    }
  }

  // ============================================================================
  // REAL-TIME ACTIVITY FEED
  // ============================================================================

  static async getActivityFeed(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const {
        page = '1',
        limit = '50',
        level,
        eventType,
        service,
        environment,
        search,
      } = req.query;

      const data = await AnalyticsService.getActivityFeed(projectId, {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        level: level as string,
        eventType: eventType as string,
        service: service as string,
        environment: environment as string,
        search: search as string,
      });

      return res.status(200).json({
        status: 'success',
        message: 'Activity feed fetched successfully',
        data: data.logs,
        meta: data.pagination,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to fetch activity feed');
    }
  }

  static async getActivityStats(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { timeRange = '1h' } = req.query;

      const data = await AnalyticsService.getActivityStats(projectId, {
        timeRange: timeRange as string,
      });

      return res.status(200).json({
        status: 'success',
        message: 'Activity stats fetched successfully',
        data,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to fetch activity stats');
    }
  }

  static async getFilterValues(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;

      const data = await AnalyticsService.getFilterValues(projectId);

      return res.status(200).json({
        status: 'success',
        message: 'Filter values fetched successfully',
        data,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to fetch filter values');
    }
  }

  static async streamActivity(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { since } = req.query;

      const data = await AnalyticsService.streamActivity(projectId, {
        since: since ? new Date(since as string) : new Date(Date.now() - 10000),
      });

      return res.status(200).json({
        status: 'success',
        message: 'Activity stream fetched successfully',
        data,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to stream activity');
    }
  }

  // ============================================================================
  // SESSION ANALYTICS
  // ============================================================================

  static async getSessions(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { page = '1', limit = '20', timeRange = '2h' } = req.query;

      const data = await AnalyticsService.getSessions(projectId, {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        timeRange: timeRange as string,
      });

      return res.status(200).json({
        status: 'success',
        message: 'Sessions fetched successfully',
        data: data.sessions,
        meta: data.pagination,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to fetch sessions');
    }
  }

  static async getSessionDetails(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId, sessionId } = req.params;

      const data = await AnalyticsService.getSessionDetails(projectId, sessionId);

      return res.status(200).json({
        status: 'success',
        message: 'Session details fetched successfully',
        data,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to fetch session details');
    }
  }

  static async getSessionTimeline(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId, sessionId } = req.params;

      const data = await AnalyticsService.getSessionTimeline(projectId, sessionId);

      return res.status(200).json({
        status: 'success',
        message: 'Session timeline fetched successfully',
        data,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to fetch session timeline');
    }
  }

  static async getSessionStats(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { timeRange = '24h' } = req.query;

      const data = await AnalyticsService.getSessionStats(projectId, {
        timeRange: timeRange as string,
      });

      return res.status(200).json({
        status: 'success',
        message: 'Session stats fetched successfully',
        data,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to fetch session stats');
    }
  }

  static async getUserJourneys(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { timeRange = '7d', limit = '10' } = req.query;

      const data = await AnalyticsService.getUserJourneys(projectId, {
        timeRange: timeRange as string,
        limit: parseInt(limit as string),
      });

      return res.status(200).json({
        status: 'success',
        message: 'User journeys fetched successfully',
        data,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to fetch user journeys');
    }
  }

  // ============================================================================
  // ENVIRONMENT ANALYTICS
  // ============================================================================

  static async getEnvironmentStats(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const timeRange = (req.query.timeRange as string) || "7d";

      const data = await AnalyticsService.getEnvironmentStats(projectId, { timeRange });

      return res.status(200).json({
        status: "success",
        message: "Environment statistics retrieved",
        data,
        meta: { projectId, timeRange },
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, "Failed to fetch environment statistics");
    }
  }

  // ============================================================================
  // NETWORK ANALYTICS
  // ============================================================================

  static async getNetworkOverview(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { timeRange = '24h' } = req.query;

      const data = await AnalyticsService.getNetworkOverview(projectId, {
        timeRange: timeRange as string,
      });

      return res.status(200).json({
        status: 'success',
        message: 'Network overview fetched successfully',
        data,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to fetch network overview');
    }
  }

  static async getNetworkRequests(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { timeRange = '24h', page = '1', limit = '20', status, method, search } = req.query;

      const data = await AnalyticsService.getNetworkRequests(projectId, {
        timeRange: timeRange as string,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        status: status as string,
        method: method as string,
        search: search as string,
      });

      return res.status(200).json({
        status: 'success',
        message: 'Network requests fetched successfully',
        data: data.requests,
        meta: data.pagination,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to fetch network requests');
    }
  }

  static async getNetworkTimeline(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { timeRange = '24h', granularity = 'hour' } = req.query;

      const data = await AnalyticsService.getNetworkTimeline(projectId, {
        timeRange: timeRange as string,
        granularity: granularity as 'hour' | 'day',
      });

      return res.status(200).json({
        status: 'success',
        message: 'Network timeline fetched successfully',
        data,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to fetch network timeline');
    }
  }

  static async getNetworkTopEndpoints(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { timeRange = '24h', limit = '10' } = req.query;

      const data = await AnalyticsService.getNetworkTopEndpoints(projectId, {
        timeRange: timeRange as string,
        limit: parseInt(limit as string),
      });

      return res.status(200).json({
        status: 'success',
        message: 'Top network endpoints fetched successfully',
        data,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to fetch top network endpoints');
    }
  }

  static async getNetworkSlowest(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { timeRange = '24h', limit = '10' } = req.query;

      const data = await AnalyticsService.getNetworkSlowest(projectId, {
        timeRange: timeRange as string,
        limit: parseInt(limit as string),
      });

      return res.status(200).json({
        status: 'success',
        message: 'Slowest network endpoints fetched successfully',
        data,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to fetch slowest network endpoints');
    }
  }

  // ============================================================================
  // INTERACTION ANALYTICS
  // ============================================================================

  static async getInteractionOverview(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { timeRange = '24h' } = req.query;

      const data = await AnalyticsService.getInteractionOverview(projectId, {
        timeRange: timeRange as string,
      });

      return res.status(200).json({
        status: 'success',
        message: 'Interaction overview fetched successfully',
        data,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to fetch interaction overview');
    }
  }

  static async getInteractionTimeline(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { timeRange = '24h', granularity = 'hour' } = req.query;

      const data = await AnalyticsService.getInteractionTimeline(projectId, {
        timeRange: timeRange as string,
        granularity: granularity as 'hour' | 'day',
      });

      return res.status(200).json({
        status: 'success',
        message: 'Interaction timeline fetched successfully',
        data,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to fetch interaction timeline');
    }
  }

  static async getInteractionTopElements(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { timeRange = '24h', limit = '10' } = req.query;

      const data = await AnalyticsService.getInteractionTopElements(projectId, {
        timeRange: timeRange as string,
        limit: parseInt(limit as string),
      });

      return res.status(200).json({
        status: 'success',
        message: 'Top interaction elements fetched successfully',
        data,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to fetch top interaction elements');
    }
  }

  static async getInteractionMostClicked(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { timeRange = '24h', limit = '10' } = req.query;

      const data = await AnalyticsService.getInteractionMostClicked(projectId, {
        timeRange: timeRange as string,
        limit: parseInt(limit as string),
      });

      return res.status(200).json({
        status: 'success',
        message: 'Most clicked elements fetched successfully',
        data,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to fetch most clicked elements');
    }
  }

  // ============================================================================
  // CONSOLE ANALYTICS
  // ============================================================================

  static async getConsoleOverview(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { timeRange = '24h' } = req.query;

      const data = await AnalyticsService.getConsoleOverview(projectId, {
        timeRange: timeRange as string,
      });

      return res.status(200).json({
        status: 'success',
        message: 'Console overview fetched successfully',
        data,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to fetch console overview');
    }
  }

  static async getConsoleMessages(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { timeRange = '24h', page = '1', limit = '20', level, search } = req.query;

      const data = await AnalyticsService.getConsoleMessages(projectId, {
        timeRange: timeRange as string,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        level: level as string,
        search: search as string,
      });

      return res.status(200).json({
        status: 'success',
        message: 'Console messages fetched successfully',
        data: data.messages,
        meta: data.pagination,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to fetch console messages');
    }
  }

  static async getConsoleTimeline(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { timeRange = '24h', granularity = 'hour' } = req.query;

      const data = await AnalyticsService.getConsoleTimeline(projectId, {
        timeRange: timeRange as string,
        granularity: granularity as 'hour' | 'day',
      });

      return res.status(200).json({
        status: 'success',
        message: 'Console timeline fetched successfully',
        data,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to fetch console timeline');
    }
  }

  // ============================================================================
  // PAGEVIEW ANALYTICS
  // ============================================================================

  static async getPageviewOverview(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { timeRange = '24h' } = req.query;

      const data = await AnalyticsService.getPageviewOverview(projectId, {
        timeRange: timeRange as string,
      });

      return res.status(200).json({
        status: 'success',
        message: 'Pageview overview fetched successfully',
        data,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to fetch pageview overview');
    }
  }

  static async getPageviewTimeline(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { timeRange = '24h', granularity = 'hour' } = req.query;

      const data = await AnalyticsService.getPageviewTimeline(projectId, {
        timeRange: timeRange as string,
        granularity: granularity as 'hour' | 'day',
      });

      return res.status(200).json({
        status: 'success',
        message: 'Pageview timeline fetched successfully',
        data,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to fetch pageview timeline');
    }
  }

  static async getPageviewTopPages(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { timeRange = '24h', limit = '10' } = req.query;

      const data = await AnalyticsService.getPageviewTopPages(projectId, {
        timeRange: timeRange as string,
        limit: parseInt(limit as string),
      });

      return res.status(200).json({
        status: 'success',
        message: 'Top pages fetched successfully',
        data,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to fetch top pages');
    }
  }

  static async getPageviewReferrers(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { timeRange = '24h', limit = '10' } = req.query;

      const data = await AnalyticsService.getPageviewReferrers(projectId, {
        timeRange: timeRange as string,
        limit: parseInt(limit as string),
      });

      return res.status(200).json({
        status: 'success',
        message: 'Pageview referrers fetched successfully',
        data,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to fetch pageview referrers');
    }
  }

  static async getPageviewNavigationFlow(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { timeRange = '24h', limit = '20' } = req.query;

      const data = await AnalyticsService.getPageviewNavigationFlow(projectId, {
        timeRange: timeRange as string,
        limit: parseInt(limit as string),
      });

      return res.status(200).json({
        status: 'success',
        message: 'Pageview navigation flow fetched successfully',
        data,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to fetch pageview navigation flow');
    }
  }

  // ============================================================================
  // CROSS-DASHBOARD UTILITIES
  // ============================================================================

  static async getDashboardOverview(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { timeRange = '24h' } = req.query;

      const data = await AnalyticsService.getDashboardOverview(projectId, {
        timeRange: timeRange as string,
      });

      return res.status(200).json({
        status: 'success',
        message: 'Dashboard overview fetched successfully',
        data,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to fetch dashboard overview');
    }
  }

  static async exportAnalytics(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { format = 'json', ...filters } = req.body;

      const data = await AnalyticsService.exportAnalytics(projectId, {
        format: format as 'json' | 'csv',
        ...filters,
      });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `apperio-analytics-${projectId}-${timestamp}.${format}`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        // Send raw CSV string directly, not wrapped in JSON
        return res.status(200).send(data);
      } else {
        res.setHeader('Content-Type', 'application/json');
        // Send raw JSON data directly, not wrapped in { status, data }
        return res.status(200).send(JSON.stringify(data));
      }
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to export analytics');
    }
  }

  static async getAlerts(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { severity, status } = req.query;

      const data = await AnalyticsService.getAlerts(projectId, {
        severity: severity as string,
        status: status as 'active' | 'resolved',
      });

      return res.status(200).json({
        status: 'success',
        message: 'Alerts fetched successfully',
        data,
      } as ApiResponse);
    } catch (error) {
      return AnalyticsController.handleError(error as Error, res, 'Failed to fetch alerts');
    }
  }
}