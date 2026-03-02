// src/config/database.config.ts

import mongoose, { ConnectOptions } from "mongoose";
import { config } from "./index";
import logger from "../utils/logger";

/**
 * Database connection options
 */
const dbOptions: ConnectOptions = {
  maxPoolSize: config.database.options.maxPoolSize,
  serverSelectionTimeoutMS: config.database.options.serverSelectionTimeoutMS,
  socketTimeoutMS: config.database.options.socketTimeoutMS,
  autoIndex: config.env !== "production", // Disable auto-indexing in production
};

/**
 * Connect to MongoDB
 */
export async function connectDatabase(): Promise<void> {
  try {
    mongoose.set("strictQuery", true);

    // Connection event handlers
    mongoose.connection.on("connected", () => {
      logger.info("MongoDB connected successfully", {
        host: mongoose.connection.host,
        name: mongoose.connection.name,
      });
    });

    mongoose.connection.on("error", (err) => {
      logger.error("MongoDB connection error", {
        error: err.message,
        stack: err.stack,
      });
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected");
    });

    // Connect to database
    await mongoose.connect(config.database.uri, dbOptions);

    // Graceful shutdown
    process.on("SIGINT", async () => {
      await mongoose.connection.close();
      logger.info("MongoDB connection closed due to application termination");
      process.exit(0);
    });
  } catch (error) {
    logger.error("Failed to connect to MongoDB", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

/**
 * Disconnect from MongoDB
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await mongoose.connection.close();
    logger.info("MongoDB disconnected");
  } catch (error) {
    logger.error("Error disconnecting from MongoDB", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

/**
 * Get database connection status
 */
export function getDatabaseStatus(): {
  connected: boolean;
  readyState: string;
  host?: string;
  name?: string;
} {
  const stateMap: Record<number, string> = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  return {
    connected: mongoose.connection.readyState === 1,
    readyState: stateMap[mongoose.connection.readyState] || "unknown",
    host: mongoose.connection.host,
    name: mongoose.connection.name,
  };
}
