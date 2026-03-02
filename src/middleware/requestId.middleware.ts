// src/middleware/requestId.middleware.ts

import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";

/**
 * Extend Express Request to include requestId
 */
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

/**
 * Middleware to generate and attach a unique request ID
 * This ID can be used for request correlation in logs and error tracking
 */
export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Check if request ID is already provided (e.g., from load balancer)
  const existingId = req.headers["x-request-id"] as string;

  // Use existing ID or generate a new one
  const requestId = existingId || uuidv4();

  // Attach to request object
  req.requestId = requestId;

  // Send in response headers for client-side correlation
  res.setHeader("X-Request-ID", requestId);

  next();
};
