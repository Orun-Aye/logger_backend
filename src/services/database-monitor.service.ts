// src/services/database-monitor.service.ts

import mongoose from "mongoose";
import logger from "../utils/logger";
import { LogModel } from "../models/log.model";
import { ProjectModel } from "../models/project.model";
import { UserModel } from "../models/user.model";
import { AlertEventModel } from "../models/alertEvent.model";
import { AlertRuleModel } from "../models/alertRule.model";

/**
 * Collection statistics
 */
interface CollectionStats {
  name: string;
  count: number;
  size: number; // bytes
  avgObjSize: number; // bytes
  storageSize: number; // bytes
  indexes: number;
  indexSize: number; // bytes
}

/**
 * Database statistics
 */
interface DatabaseStats {
  collections: CollectionStats[];
  totalSize: number;
  totalIndexSize: number;
  totalDocuments: number;
}

/**
 * Index information
 */
interface IndexInfo {
  collection: string;
  name: string;
  keys: Record<string, any>;
  unique?: boolean;
  sparse?: boolean;
}

/**
 * Query performance metrics
 */
interface QueryMetrics {
  collection: string;
  operation: string;
  executionTime: number;
  docsExamined: number;
  docsReturned: number;
  indexUsed?: string;
}

/**
 * Database monitoring service
 */
export class DatabaseMonitorService {
  /**
   * Get collection statistics
   */
  static async getCollectionStats(
    collectionName: string
  ): Promise<CollectionStats | null> {
    try {
      const stats = await mongoose.connection.db.command({
        collStats: collectionName,
      });

      return {
        name: collectionName,
        count: stats.count,
        size: stats.size,
        avgObjSize: stats.avgObjSize,
        storageSize: stats.storageSize,
        indexes: stats.nindexes,
        indexSize: stats.totalIndexSize,
      };
    } catch (error) {
      logger.error(`Failed to get stats for collection ${collectionName}`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return null;
    }
  }

  /**
   * Get database-wide statistics
   */
  static async getDatabaseStats(): Promise<DatabaseStats> {
    const collectionNames = ["logs", "projects", "users", "alertevents", "alertrules"];

    const collectionStats = await Promise.all(
      collectionNames.map((name) => this.getCollectionStats(name))
    );

    const validStats = collectionStats.filter(
      (stat): stat is CollectionStats => stat !== null
    );

    const totalSize = validStats.reduce((sum, stat) => sum + stat.size, 0);
    const totalIndexSize = validStats.reduce(
      (sum, stat) => sum + stat.indexSize,
      0
    );
    const totalDocuments = validStats.reduce((sum, stat) => sum + stat.count, 0);

    return {
      collections: validStats,
      totalSize,
      totalIndexSize,
      totalDocuments,
    };
  }

  /**
   * List all indexes across collections
   */
  static async listAllIndexes(): Promise<IndexInfo[]> {
    const models = [
      { name: "logs", model: LogModel },
      { name: "projects", model: ProjectModel },
      { name: "users", model: UserModel },
      { name: "alertevents", model: AlertEventModel },
      { name: "alertrules", model: AlertRuleModel },
    ];

    const allIndexes: IndexInfo[] = [];

    for (const { name, model } of models) {
      try {
        const indexes = await model.collection.indexes();

        for (const index of indexes) {
          allIndexes.push({
            collection: name,
            name: index.name,
            keys: index.key,
            unique: index.unique,
            sparse: index.sparse,
          });
        }
      } catch (error) {
        logger.error(`Failed to list indexes for ${name}`, {
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return allIndexes;
  }

  /**
   * Verify required indexes exist
   */
  static async verifyIndexes(): Promise<{
    verified: boolean;
    missing: string[];
    existing: string[];
  }> {
    const requiredIndexes: Record<string, string[]> = {
      logs: [
        "projectId_1_timestamp_-1",
        "projectId_1_level_1",
        "projectId_1_eventType_1",
      ],
      projects: ["ownerId_1", "apiKey_1"],
      users: ["email_1"],
      alertevents: ["projectId_1_triggeredAt_-1"],
      alertrules: ["projectId_1"],
    };

    const allIndexes = await this.listAllIndexes();
    const missing: string[] = [];
    const existing: string[] = [];

    for (const [collection, indexes] of Object.entries(requiredIndexes)) {
      const collectionIndexes = allIndexes
        .filter((idx) => idx.collection === collection)
        .map((idx) => idx.name);

      for (const requiredIndex of indexes) {
        const fullName = `${collection}.${requiredIndex}`;
        if (collectionIndexes.includes(requiredIndex)) {
          existing.push(fullName);
        } else {
          missing.push(fullName);
        }
      }
    }

    return {
      verified: missing.length === 0,
      missing,
      existing,
    };
  }

  /**
   * Analyze slow queries (requires MongoDB profiling to be enabled)
   */
  static async getSlowQueries(limit: number = 10): Promise<any[]> {
    try {
      const systemProfile = mongoose.connection.db.collection("system.profile");

      const slowQueries = await systemProfile
        .find({ millis: { $gt: 100 } }) // Queries taking more than 100ms
        .sort({ ts: -1 })
        .limit(limit)
        .toArray();

      return slowQueries;
    } catch (error) {
      logger.warn("Could not retrieve slow queries (profiling may not be enabled)", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return [];
    }
  }

  /**
   * Get connection pool statistics
   */
  static getConnectionPoolStats(): {
    current: number;
    available: number;
    maxPoolSize: number;
  } {
    const client = mongoose.connection.getClient();

    return {
      current: (client as any).topology?.s?.pool?.totalConnectionCount || 0,
      available: (client as any).topology?.s?.pool?.availableConnectionCount || 0,
      maxPoolSize: mongoose.connection.getClient().options.maxPoolSize || 10,
    };
  }

  /**
   * Monitor query performance
   */
  static async monitorQuery<T>(
    queryFn: () => Promise<T>,
    metadata: { collection: string; operation: string }
  ): Promise<{ result: T; metrics: QueryMetrics }> {
    const startTime = Date.now();

    const result = await queryFn();

    const executionTime = Date.now() - startTime;

    const metrics: QueryMetrics = {
      collection: metadata.collection,
      operation: metadata.operation,
      executionTime,
      docsExamined: 0, // Would need to use explain() to get this
      docsReturned: Array.isArray(result) ? result.length : 1,
    };

    // Log slow queries
    if (executionTime > 1000) {
      logger.warn("Slow query detected", metrics);
    }

    return { result, metrics };
  }

  /**
   * Check database health
   */
  static async checkHealth(): Promise<{
    healthy: boolean;
    latency: number;
    connectionCount: number;
  }> {
    const startTime = Date.now();

    try {
      await mongoose.connection.db.admin().ping();
      const latency = Date.now() - startTime;

      const poolStats = this.getConnectionPoolStats();

      return {
        healthy: true,
        latency,
        connectionCount: poolStats.current,
      };
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - startTime,
        connectionCount: 0,
      };
    }
  }

  /**
   * Get database size in human-readable format
   */
  static formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }
}
