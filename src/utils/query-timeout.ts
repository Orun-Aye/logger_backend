// src/utils/query-timeout.ts

import mongoose from "mongoose";
import logger from "./logger";

/**
 * Default query timeout in milliseconds
 */
const DEFAULT_QUERY_TIMEOUT = 10000; // 10 seconds

/**
 * Query timeout configuration per operation type
 */
export const queryTimeouts = {
  find: 10000, // 10 seconds for read operations
  aggregate: 30000, // 30 seconds for aggregations
  insert: 5000, // 5 seconds for inserts
  update: 5000, // 5 seconds for updates
  delete: 5000, // 5 seconds for deletes
};

/**
 * Wrapper to add timeout to mongoose queries
 */
export function withTimeout<T>(
  query: mongoose.Query<T, any>,
  timeout: number = DEFAULT_QUERY_TIMEOUT,
  operationName?: string
): mongoose.Query<T, any> {
  return query.maxTimeMS(timeout).catch((error) => {
    if (error.name === "MongooseError" && error.message.includes("maxTimeMS")) {
      logger.error("Query timeout exceeded", {
        operation: operationName || "unknown",
        timeout,
      });
      throw new Error(`Query timeout exceeded (${timeout}ms)`);
    }
    throw error;
  }) as any;
}

/**
 * Wrapper for aggregate pipelines with timeout
 */
export function withAggregateTimeout<T>(
  aggregate: mongoose.Aggregate<T[]>,
  timeout: number = queryTimeouts.aggregate,
  operationName?: string
): mongoose.Aggregate<T[]> {
  return aggregate.option({ maxTimeMS: timeout }).catch((error) => {
    if (error.name === "MongooseError" && error.message.includes("maxTimeMS")) {
      logger.error("Aggregation timeout exceeded", {
        operation: operationName || "unknown",
        timeout,
      });
      throw new Error(`Aggregation timeout exceeded (${timeout}ms)`);
    }
    throw error;
  }) as any;
}

/**
 * Monitor and log slow queries
 */
export function monitorSlowQueries(): void {
  mongoose.set("debug", (collectionName, method, query, doc, options) => {
    const startTime = Date.now();

    // Log query details
    logger.debug("MongoDB Query", {
      collection: collectionName,
      method,
      query: JSON.stringify(query),
    });

    // Monitor completion time
    process.nextTick(() => {
      const duration = Date.now() - startTime;

      if (duration > 1000) {
        // Log queries taking more than 1 second
        logger.warn("Slow query detected", {
          collection: collectionName,
          method,
          query: JSON.stringify(query),
          duration: `${duration}ms`,
        });
      }
    });
  });
}

/**
 * Set global query timeout for all queries
 */
export function setGlobalQueryTimeout(timeout: number = DEFAULT_QUERY_TIMEOUT): void {
  // Set default maxTimeMS for all queries
  mongoose.plugin((schema) => {
    schema.pre("find", function () {
      this.maxTimeMS(queryTimeouts.find);
    });

    schema.pre("findOne", function () {
      this.maxTimeMS(queryTimeouts.find);
    });

    schema.pre("updateOne", function () {
      this.maxTimeMS(queryTimeouts.update);
    });

    schema.pre("updateMany", function () {
      this.maxTimeMS(queryTimeouts.update);
    });

    schema.pre("deleteOne", function () {
      this.maxTimeMS(queryTimeouts.delete);
    });

    schema.pre("deleteMany", function () {
      this.maxTimeMS(queryTimeouts.delete);
    });
  });

  logger.info("Global query timeouts configured", queryTimeouts);
}
