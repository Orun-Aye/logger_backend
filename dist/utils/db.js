"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeRedis = exports.initializeRedis = exports.connectDB = exports.redisClient = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const redis_1 = require("redis");
const config_1 = require("../config");
const logger_1 = __importDefault(require("./logger"));
// Redis client instance
exports.redisClient = null;
/**
 * Legacy connectDB function - kept for backward compatibility
 * Use connectDatabase from config/database.config.ts for new code
 */
const connectDB = async (uri) => {
    try {
        if (!uri) {
            throw new Error("MongoDB URI is not defined");
        }
        await mongoose_1.default.connect(uri);
        console.log("✅ MongoDB connected successfully");
    }
    catch (error) {
        console.error("❌ MongoDB connection failed:", error);
        process.exit(1);
    }
};
exports.connectDB = connectDB;
/**
 * Initialize Redis client
 */
const initializeRedis = async () => {
    if (!config_1.config.redis.enabled) {
        logger_1.default.info("Redis is disabled in configuration");
        return;
    }
    try {
        exports.redisClient = (0, redis_1.createClient)({
            url: config_1.config.redis.url,
        });
        exports.redisClient.on("error", (err) => {
            logger_1.default.error("Redis client error", { error: err.message });
        });
        exports.redisClient.on("connect", () => {
            logger_1.default.info("Redis client connected");
        });
        await exports.redisClient.connect();
        logger_1.default.info("Redis initialized successfully");
    }
    catch (error) {
        logger_1.default.error("Failed to initialize Redis", {
            error: error instanceof Error ? error.message : "Unknown error",
        });
        // Don't exit process - Redis is optional
    }
};
exports.initializeRedis = initializeRedis;
/**
 * Close Redis connection
 */
const closeRedis = async () => {
    if (exports.redisClient) {
        await exports.redisClient.quit();
        logger_1.default.info("Redis connection closed");
    }
};
exports.closeRedis = closeRedis;
