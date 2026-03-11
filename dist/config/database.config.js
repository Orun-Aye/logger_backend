"use strict";
// src/config/database.config.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDatabase = connectDatabase;
exports.disconnectDatabase = disconnectDatabase;
exports.getDatabaseStatus = getDatabaseStatus;
const mongoose_1 = __importDefault(require("mongoose"));
const index_1 = require("./index");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Database connection options
 */
const dbOptions = {
    maxPoolSize: index_1.config.database.options.maxPoolSize,
    serverSelectionTimeoutMS: index_1.config.database.options.serverSelectionTimeoutMS,
    socketTimeoutMS: index_1.config.database.options.socketTimeoutMS,
    autoIndex: index_1.config.env !== "production", // Disable auto-indexing in production
};
/**
 * Connect to MongoDB
 */
async function connectDatabase() {
    try {
        mongoose_1.default.set("strictQuery", true);
        // Connection event handlers
        mongoose_1.default.connection.on("connected", () => {
            logger_1.default.info("MongoDB connected successfully", {
                host: mongoose_1.default.connection.host,
                name: mongoose_1.default.connection.name,
            });
        });
        mongoose_1.default.connection.on("error", (err) => {
            logger_1.default.error("MongoDB connection error", {
                error: err.message,
                stack: err.stack,
            });
        });
        mongoose_1.default.connection.on("disconnected", () => {
            logger_1.default.warn("MongoDB disconnected");
        });
        // Connect to database
        await mongoose_1.default.connect(index_1.config.database.uri, dbOptions);
        // Graceful shutdown
        process.on("SIGINT", async () => {
            await mongoose_1.default.connection.close();
            logger_1.default.info("MongoDB connection closed due to application termination");
            process.exit(0);
        });
    }
    catch (error) {
        logger_1.default.error("Failed to connect to MongoDB", {
            error: error instanceof Error ? error.message : "Unknown error",
        });
        throw error;
    }
}
/**
 * Disconnect from MongoDB
 */
async function disconnectDatabase() {
    try {
        await mongoose_1.default.connection.close();
        logger_1.default.info("MongoDB disconnected");
    }
    catch (error) {
        logger_1.default.error("Error disconnecting from MongoDB", {
            error: error instanceof Error ? error.message : "Unknown error",
        });
        throw error;
    }
}
/**
 * Get database connection status
 */
function getDatabaseStatus() {
    const stateMap = {
        0: "disconnected",
        1: "connected",
        2: "connecting",
        3: "disconnecting",
    };
    return {
        connected: mongoose_1.default.connection.readyState === 1,
        readyState: stateMap[mongoose_1.default.connection.readyState] || "unknown",
        host: mongoose_1.default.connection.host,
        name: mongoose_1.default.connection.name,
    };
}
