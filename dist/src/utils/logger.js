"use strict";
// src/utils/logger.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loggerUtils = void 0;
const winston_1 = __importDefault(require("winston"));
const winston_daily_rotate_file_1 = __importDefault(require("winston-daily-rotate-file"));
const path_1 = __importDefault(require("path"));
/**
 * Log levels
 */
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};
/**
 * Log level colors for console output
 */
const colors = {
    error: "red",
    warn: "yellow",
    info: "green",
    http: "magenta",
    debug: "blue",
};
winston_1.default.addColors(colors);
/**
 * Determine log level based on environment
 */
const level = () => {
    const env = process.env.NODE_ENV || "development";
    const isDevelopment = env === "development";
    return isDevelopment ? "debug" : "info";
};
/**
 * Custom format for development (pretty print)
 */
const devFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), winston_1.default.format.colorize({ all: true }), winston_1.default.format.printf((info) => `${info.timestamp} [${info.level}]: ${info.message}`));
/**
 * Custom format for production (JSON)
 */
const prodFormat = winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json());
/**
 * Console transport configuration
 */
const consoleTransport = new winston_1.default.transports.Console({
    format: process.env.NODE_ENV === "production" ? prodFormat : devFormat,
});
/**
 * File transport for errors (with daily rotation)
 */
const errorFileTransport = new winston_daily_rotate_file_1.default({
    filename: path_1.default.join("logs", "error-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    level: "error",
    maxFiles: "14d", // Keep logs for 14 days
    maxSize: "20m", // Rotate when file reaches 20MB
    format: prodFormat,
});
/**
 * File transport for all logs (with daily rotation)
 */
const combinedFileTransport = new winston_daily_rotate_file_1.default({
    filename: path_1.default.join("logs", "combined-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    maxFiles: "7d", // Keep logs for 7 days
    maxSize: "20m",
    format: prodFormat,
});
/**
 * Create the logger instance
 */
const logger = winston_1.default.createLogger({
    level: level(),
    levels,
    transports: [consoleTransport],
});
/**
 * Add file transports in production
 */
if (process.env.NODE_ENV === "production") {
    logger.add(errorFileTransport);
    logger.add(combinedFileTransport);
}
/**
 * Helper methods for structured logging
 */
exports.loggerUtils = {
    /**
     * Log HTTP request
     */
    logRequest: (data) => {
        logger.http("HTTP Request", data);
    },
    /**
     * Log error with context
     */
    logError: (error, context) => {
        logger.error("Error occurred", {
            message: error.message,
            stack: error.stack,
            ...context,
        });
    },
    /**
     * Log database query
     */
    logQuery: (data) => {
        if (data.error) {
            logger.error("Database query failed", data);
        }
        else {
            logger.debug("Database query", data);
        }
    },
    /**
     * Log external API call
     */
    logExternalCall: (data) => {
        if (data.error) {
            logger.error("External API call failed", data);
        }
        else {
            logger.debug("External API call", data);
        }
    },
    /**
     * Log authentication event
     */
    logAuth: (data) => {
        logger.info("Authentication event", data);
    },
    /**
     * Log WebSocket event
     */
    logWebSocket: (data) => {
        if (data.error) {
            logger.error("WebSocket error", data);
        }
        else {
            logger.debug("WebSocket event", data);
        }
    },
};
exports.default = logger;
