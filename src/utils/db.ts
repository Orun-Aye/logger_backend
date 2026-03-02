import mongoose from "mongoose";
import { createClient } from "redis";
import { config } from "../config";
import logger from "./logger";

// Redis client instance
export let redisClient: ReturnType<typeof createClient> | null = null;

/**
 * Legacy connectDB function - kept for backward compatibility
 * Use connectDatabase from config/database.config.ts for new code
 */
export const connectDB = async (uri?: string | undefined): Promise<void> => {
    try {
        if (!uri) {
            throw new Error("MongoDB URI is not defined");
        }
        await mongoose.connect(uri);
        console.log("✅ MongoDB connected successfully");
    } catch (error) {
        console.error("❌ MongoDB connection failed:", error);
        process.exit(1);
    }
};

/**
 * Initialize Redis client
 */
export const initializeRedis = async (): Promise<void> => {
  if (!config.redis.enabled) {
    logger.info("Redis is disabled in configuration");
    return;
  }

  try {
    redisClient = createClient({
      url: config.redis.url,
    });

    redisClient.on("error", (err) => {
      logger.error("Redis client error", { error: err.message });
    });

    redisClient.on("connect", () => {
      logger.info("Redis client connected");
    });

    await redisClient.connect();
    logger.info("Redis initialized successfully");
  } catch (error) {
    logger.error("Failed to initialize Redis", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    // Don't exit process - Redis is optional
  }
};

/**
 * Close Redis connection
 */
export const closeRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    logger.info("Redis connection closed");
  }
};