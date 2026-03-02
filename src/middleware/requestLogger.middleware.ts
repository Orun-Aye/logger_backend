// src/middleware/requestLogger.middleware.ts

import { Request, Response, NextFunction } from "express";
import { loggerUtils } from "../utils/logger";

/**
 * Middleware to log all HTTP requests
 * Captures method, path, status code, duration, and request ID
 */
export const requestLoggerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Capture start time
  const startTime = Date.now();

  // Capture original res.json to intercept response
  const originalJson = res.json.bind(res);

  // Override res.json to log after response is sent
  res.json = function (body: any) {
    // Calculate duration
    const duration = Date.now() - startTime;

    // Log the request
    loggerUtils.logRequest({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      requestId: req.requestId,
      userId: (req as any).userId,
    });

    // Call original json method
    return originalJson(body);
  };

  // Handle errors in response
  res.on("finish", () => {
    // If response was not sent via json, log here
    if (!res.headersSent || res.statusCode >= 400) {
      const duration = Date.now() - startTime;
      loggerUtils.logRequest({
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        requestId: req.requestId,
        userId: (req as any).userId,
      });
    }
  });

  next();
};

/**
 * Paths to skip logging (health checks, static assets, etc.)
 */
const skipPaths = ["/health", "/live", "/ready", "/favicon.ico"];

/**
 * Conditional request logger that skips certain paths
 */
export const conditionalRequestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Skip logging for certain paths
  if (skipPaths.some((path) => req.path.startsWith(path))) {
    return next();
  }

  // Apply request logger
  return requestLoggerMiddleware(req, res, next);
};
