// src/utils/logger.ts

import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";

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

winston.addColors(colors);

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
const devFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} [${info.level}]: ${info.message}`
  )
);

/**
 * Custom format for production (JSON)
 */
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Console transport configuration
 */
const consoleTransport = new winston.transports.Console({
  format: process.env.NODE_ENV === "production" ? prodFormat : devFormat,
});

/**
 * File transport for errors (with daily rotation)
 */
const errorFileTransport = new DailyRotateFile({
  filename: path.join("logs", "error-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  level: "error",
  maxFiles: "14d", // Keep logs for 14 days
  maxSize: "20m", // Rotate when file reaches 20MB
  format: prodFormat,
});

/**
 * File transport for all logs (with daily rotation)
 */
const combinedFileTransport = new DailyRotateFile({
  filename: path.join("logs", "combined-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxFiles: "7d", // Keep logs for 7 days
  maxSize: "20m",
  format: prodFormat,
});

/**
 * Create the logger instance
 */
const logger = winston.createLogger({
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
export const loggerUtils = {
  /**
   * Log HTTP request
   */
  logRequest: (data: {
    method: string;
    path: string;
    statusCode: number;
    duration: number;
    requestId?: string;
    userId?: string;
  }) => {
    logger.http("HTTP Request", data);
  },

  /**
   * Log error with context
   */
  logError: (error: Error, context?: Record<string, any>) => {
    logger.error("Error occurred", {
      message: error.message,
      stack: error.stack,
      ...context,
    });
  },

  /**
   * Log database query
   */
  logQuery: (data: {
    collection: string;
    operation: string;
    duration?: number;
    error?: string;
  }) => {
    if (data.error) {
      logger.error("Database query failed", data);
    } else {
      logger.debug("Database query", data);
    }
  },

  /**
   * Log external API call
   */
  logExternalCall: (data: {
    service: string;
    method: string;
    url: string;
    statusCode?: number;
    duration?: number;
    error?: string;
  }) => {
    if (data.error) {
      logger.error("External API call failed", data);
    } else {
      logger.debug("External API call", data);
    }
  },

  /**
   * Log authentication event
   */
  logAuth: (data: {
    event: "login" | "logout" | "signup" | "token_refresh" | "failed_login";
    userId?: string;
    email?: string;
    ipAddress?: string;
    userAgent?: string;
  }) => {
    logger.info("Authentication event", data);
  },

  /**
   * Log WebSocket event
   */
  logWebSocket: (data: {
    event: "connect" | "disconnect" | "message" | "error";
    userId?: string;
    room?: string;
    error?: string;
  }) => {
    if (data.error) {
      logger.error("WebSocket error", data);
    } else {
      logger.debug("WebSocket event", data);
    }
  },
};

export default logger;
