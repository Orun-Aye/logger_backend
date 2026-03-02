// src/services/health.service.ts

import mongoose from "mongoose";
import { redisClient } from "../utils/db";

/**
 * Component health status
 */
interface ComponentHealth {
  status: "healthy" | "unhealthy" | "degraded";
  latency?: number;
  message?: string;
  details?: any;
}

/**
 * Overall health check response
 */
export interface HealthCheckResponse {
  status: "healthy" | "unhealthy" | "degraded";
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  components: {
    database: ComponentHealth;
    redis: ComponentHealth;
    webSocket?: ComponentHealth;
    system: ComponentHealth;
  };
}

/**
 * Health check service
 */
export class HealthService {
  /**
   * Check MongoDB connection health
   */
  private static async checkDatabase(): Promise<ComponentHealth> {
    try {
      const startTime = Date.now();

      // Check connection state
      const state = mongoose.connection.readyState;
      const stateMap: Record<number, string> = {
        0: "disconnected",
        1: "connected",
        2: "connecting",
        3: "disconnecting",
      };

      if (state !== 1) {
        return {
          status: "unhealthy",
          message: `MongoDB is ${stateMap[state] || "unknown"}`,
        };
      }

      // Ping the database to check actual connectivity
      await mongoose.connection.db.admin().ping();
      const latency = Date.now() - startTime;

      return {
        status: latency < 100 ? "healthy" : "degraded",
        latency,
        details: {
          name: mongoose.connection.name,
          host: mongoose.connection.host,
          port: mongoose.connection.port,
        },
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: error instanceof Error ? error.message : "Database check failed",
      };
    }
  }

  /**
   * Check Redis connection health
   */
  private static async checkRedis(): Promise<ComponentHealth> {
    try {
      if (!redisClient) {
        return {
          status: "unhealthy",
          message: "Redis client not initialized",
        };
      }

      const startTime = Date.now();

      // Ping Redis
      await redisClient.ping();
      const latency = Date.now() - startTime;

      return {
        status: latency < 50 ? "healthy" : "degraded",
        latency,
        details: {
          connected: redisClient.isOpen,
          ready: redisClient.isReady,
        },
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: error instanceof Error ? error.message : "Redis check failed",
      };
    }
  }

  /**
   * Check system health (memory, CPU)
   */
  private static checkSystem(): ComponentHealth {
    try {
      const memoryUsage = process.memoryUsage();
      const totalMemory = memoryUsage.heapTotal;
      const usedMemory = memoryUsage.heapUsed;
      const memoryPercent = (usedMemory / totalMemory) * 100;

      // Consider system degraded if memory usage > 80%
      const status = memoryPercent > 80 ? "degraded" : "healthy";

      return {
        status,
        details: {
          memory: {
            heapUsed: `${Math.round(usedMemory / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(totalMemory / 1024 / 1024)}MB`,
            usage: `${memoryPercent.toFixed(2)}%`,
          },
          uptime: `${Math.floor(process.uptime())}s`,
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
        },
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: error instanceof Error ? error.message : "System check failed",
      };
    }
  }

  /**
   * Comprehensive health check
   */
  static async getHealthStatus(): Promise<HealthCheckResponse> {
    const [database, redis, system] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      Promise.resolve(this.checkSystem()),
    ]);

    // Determine overall status
    let overallStatus: "healthy" | "unhealthy" | "degraded" = "healthy";

    if (
      database.status === "unhealthy" ||
      redis.status === "unhealthy" ||
      system.status === "unhealthy"
    ) {
      overallStatus = "unhealthy";
    } else if (
      database.status === "degraded" ||
      redis.status === "degraded" ||
      system.status === "degraded"
    ) {
      overallStatus = "degraded";
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || "1.0.0",
      environment: process.env.NODE_ENV || "development",
      components: {
        database,
        redis,
        system,
      },
    };
  }

  /**
   * Readiness check - determines if the service can accept traffic
   * Returns 200 if ready, 503 if not
   */
  static async checkReadiness(): Promise<boolean> {
    try {
      // Check critical components (database required for operation)
      const database = await this.checkDatabase();

      // Service is ready if database is connected
      return database.status !== "unhealthy";
    } catch {
      return false;
    }
  }

  /**
   * Liveness check - determines if the service is alive
   * Returns 200 if alive, 503 if not
   */
  static checkLiveness(): boolean {
    // Simple liveness check - if we can execute this code, we're alive
    return true;
  }
}
