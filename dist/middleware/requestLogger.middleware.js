"use strict";
// src/middleware/requestLogger.middleware.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.conditionalRequestLogger = exports.requestLoggerMiddleware = void 0;
const logger_1 = require("../utils/logger");
/**
 * Middleware to log all HTTP requests
 * Captures method, path, status code, duration, and request ID
 */
const requestLoggerMiddleware = (req, res, next) => {
    // Capture start time
    const startTime = Date.now();
    // Capture original res.json to intercept response
    const originalJson = res.json.bind(res);
    // Override res.json to log after response is sent
    res.json = function (body) {
        // Calculate duration
        const duration = Date.now() - startTime;
        // Log the request
        logger_1.loggerUtils.logRequest({
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration,
            requestId: req.requestId,
            userId: req.userId,
        });
        // Call original json method
        return originalJson(body);
    };
    // Handle errors in response
    res.on("finish", () => {
        // If response was not sent via json, log here
        if (!res.headersSent || res.statusCode >= 400) {
            const duration = Date.now() - startTime;
            logger_1.loggerUtils.logRequest({
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                duration,
                requestId: req.requestId,
                userId: req.userId,
            });
        }
    });
    next();
};
exports.requestLoggerMiddleware = requestLoggerMiddleware;
/**
 * Paths to skip logging (health checks, static assets, etc.)
 */
const skipPaths = ["/health", "/live", "/ready", "/favicon.ico"];
/**
 * Conditional request logger that skips certain paths
 */
const conditionalRequestLogger = (req, res, next) => {
    // Skip logging for certain paths
    if (skipPaths.some((path) => req.path.startsWith(path))) {
        return next();
    }
    // Apply request logger
    return (0, exports.requestLoggerMiddleware)(req, res, next);
};
exports.conditionalRequestLogger = conditionalRequestLogger;
