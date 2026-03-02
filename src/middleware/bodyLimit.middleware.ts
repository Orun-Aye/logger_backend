// src/middleware/bodyLimit.middleware.ts

import { Request, Response, NextFunction } from "express";

/**
 * Middleware to enforce request body size limits
 * Especially important for log ingestion to prevent abuse
 */
export const bodyLimitMiddleware = (maxSizeBytes: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = req.headers["content-length"];

    if (contentLength) {
      const size = parseInt(contentLength, 10);

      if (size > maxSizeBytes) {
        return res.status(413).json({
          status: "error",
          message: `Request body too large. Maximum size is ${Math.round(maxSizeBytes / 1024)}KB`,
        });
      }
    }

    next();
  };
};

/**
 * Preset middlewares for common limits
 */
export const bodyLimits = {
  /**
   * Standard limit for most endpoints (1MB)
   */
  standard: bodyLimitMiddleware(1024 * 1024), // 1MB

  /**
   * Generous limit for log ingestion (10MB for batch uploads)
   */
  logs: bodyLimitMiddleware(10 * 1024 * 1024), // 10MB

  /**
   * Strict limit for auth endpoints (100KB)
   */
  auth: bodyLimitMiddleware(100 * 1024), // 100KB

  /**
   * Minimal limit for simple operations (50KB)
   */
  minimal: bodyLimitMiddleware(50 * 1024), // 50KB
};
