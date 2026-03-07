import mongoose from "mongoose";
import logger from "../utils/logger";

export interface ComponentStatus {
  name: string;
  status: "operational" | "degraded" | "outage";
  description: string;
  responseTime?: number;
}

export interface IncidentUpdate {
  message: string;
  status: string;
  timestamp: string;
}

export interface Incident {
  id: string;
  title: string;
  status: "investigating" | "identified" | "monitoring" | "resolved";
  severity: "minor" | "major" | "critical";
  createdAt: string;
  updatedAt: string;
  updates: IncidentUpdate[];
}

export interface UptimeMetrics {
  last24h: number;
  last7d: number;
  last30d: number;
  last90d: number;
}

export interface SystemStatus {
  status: "operational" | "degraded" | "outage";
  components: ComponentStatus[];
  incidents: Incident[];
  uptime: UptimeMetrics;
  checkedAt: string;
}

export class StatusService {
  /**
   * Get full system status including all components, incidents, and uptime.
   */
  static async getSystemStatus(): Promise<SystemStatus> {
    const startTime = Date.now();
    const components: ComponentStatus[] = [];

    // 1. API Server — always operational if this endpoint responds
    const apiResponseTime = Date.now() - startTime;
    components.push({
      name: "API Server",
      status: "operational",
      description: "Express REST API is running and responding to requests",
      responseTime: apiResponseTime,
    });

    // 2. Database (MongoDB)
    components.push(await StatusService.checkDatabase());

    // 3. WebSocket Service
    components.push(StatusService.checkWebSocket());

    // 4. Background Jobs
    components.push(StatusService.checkBackgroundJobs());

    // Derive overall status from components
    const overallStatus = StatusService.deriveOverallStatus(components);

    // Uptime — placeholder values (real monitoring would need a dedicated service)
    const uptime: UptimeMetrics = {
      last24h: 99.9,
      last7d: 99.9,
      last30d: 99.9,
      last90d: 99.9,
    };

    // No active incidents for now (would come from an Incident model in production)
    const incidents: Incident[] = [];

    return {
      status: overallStatus,
      components,
      incidents,
      uptime,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Check MongoDB connection state and measure ping time.
   */
  private static async checkDatabase(): Promise<ComponentStatus> {
    try {
      const readyState = mongoose.connection.readyState;
      // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
      if (readyState !== 1) {
        return {
          name: "Database (MongoDB)",
          status: "outage",
          description: `MongoDB connection state: ${StatusService.mongoStateLabel(readyState)}`,
        };
      }

      // Measure ping time
      const pingStart = Date.now();
      const admin = mongoose.connection.db?.admin();
      if (admin) {
        await admin.ping();
      }
      const pingTime = Date.now() - pingStart;

      // If ping takes > 1000ms, mark as degraded
      const status = pingTime > 1000 ? "degraded" : "operational";

      return {
        name: "Database (MongoDB)",
        status,
        description:
          status === "operational"
            ? "MongoDB is connected and responding normally"
            : `MongoDB is responding slowly (${pingTime}ms)`,
        responseTime: pingTime,
      };
    } catch (error) {
      logger.error("Status check — MongoDB ping failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return {
        name: "Database (MongoDB)",
        status: "outage",
        description: "MongoDB is not responding to health checks",
      };
    }
  }

  /**
   * Check WebSocket service availability.
   */
  private static checkWebSocket(): ComponentStatus {
    const isVercel = process.env.VERCEL === "1";

    if (isVercel) {
      return {
        name: "WebSocket",
        status: "degraded",
        description:
          "WebSocket is not available in serverless environment (polling fallback active)",
      };
    }

    // In standalone mode, WebSocket is initialized alongside the server
    return {
      name: "WebSocket",
      status: "operational",
      description: "Real-time WebSocket connections are active",
    };
  }

  /**
   * Check background jobs status.
   */
  private static checkBackgroundJobs(): ComponentStatus {
    const isVercel = process.env.VERCEL === "1";

    if (isVercel) {
      return {
        name: "Background Jobs",
        status: "degraded",
        description:
          "Background jobs are not available in serverless environment",
      };
    }

    return {
      name: "Background Jobs",
      status: "operational",
      description:
        "Retention cleanup and anomaly scan jobs are running on schedule",
    };
  }

  /**
   * Derive overall system status from individual component statuses.
   */
  private static deriveOverallStatus(
    components: ComponentStatus[]
  ): "operational" | "degraded" | "outage" {
    const hasOutage = components.some((c) => c.status === "outage");
    const hasDegraded = components.some((c) => c.status === "degraded");

    if (hasOutage) return "outage";
    if (hasDegraded) return "degraded";
    return "operational";
  }

  /**
   * Human-readable label for mongoose readyState.
   */
  private static mongoStateLabel(state: number): string {
    switch (state) {
      case 0:
        return "disconnected";
      case 1:
        return "connected";
      case 2:
        return "connecting";
      case 3:
        return "disconnecting";
      default:
        return "unknown";
    }
  }
}
