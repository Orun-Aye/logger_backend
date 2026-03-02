// src/middleware/errorHandler.middleware.ts

import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors";

/**
 * Standard error response format
 */
interface ErrorResponse {
  status: "error";
  message: string;
  code?: string;
  errors?: any[];
  requestId?: string;
  stack?: string;
}

/**
 * Global error handler middleware
 * Should be registered last in the middleware chain
 */
export const errorHandlerMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Default error response
  let statusCode = 500;
  let message = "Internal server error";
  let code = "INTERNAL_ERROR";
  let errors: any[] | undefined;

  // Log the error for debugging
  console.error("Error occurred:", {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    error: err.message,
    stack: err.stack,
    userId: (req as any).userId,
  });

  // Handle custom AppError instances
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    code = err.code;
    if (err.details) {
      errors = Array.isArray(err.details) ? err.details : [err.details];
    }
  }
  // Handle Zod validation errors
  else if (err instanceof ZodError) {
    statusCode = 400;
    message = "Validation failed";
    code = "VALIDATION_ERROR";
    errors = err.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message,
      code: e.code,
    }));
  }
  // Handle Mongoose validation errors
  else if (err.name === "ValidationError") {
    statusCode = 400;
    message = "Validation failed";
    code = "VALIDATION_ERROR";
    const mongooseErr = err as any;
    errors = Object.values(mongooseErr.errors || {}).map((e: any) => ({
      field: e.path,
      message: e.message,
    }));
  }
  // Handle Mongoose CastError (invalid ObjectId, etc.)
  else if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid ID format";
    code = "INVALID_ID";
  }
  // Handle MongoDB duplicate key error
  else if (err.name === "MongoServerError" && (err as any).code === 11000) {
    statusCode = 409;
    message = "Duplicate resource";
    code = "DUPLICATE_ERROR";
    const field = Object.keys((err as any).keyPattern || {})[0];
    errors = [
      {
        field,
        message: `${field} already exists`,
      },
    ];
  }
  // Handle JWT errors
  else if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
    code = "INVALID_TOKEN";
  } else if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired";
    code = "TOKEN_EXPIRED";
  }

  // Build error response
  const errorResponse: ErrorResponse = {
    status: "error",
    message,
    code,
    requestId: req.requestId,
  };

  // Add errors array if present
  if (errors && errors.length > 0) {
    errorResponse.errors = errors;
  }

  // Include stack trace in development mode
  if (process.env.NODE_ENV === "development") {
    errorResponse.stack = err.stack;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

/**
 * 404 handler for undefined routes
 * Should be registered after all route handlers but before error handler
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.status(404).json({
    status: "error",
    message: `Route ${req.method} ${req.path} not found`,
    code: "ROUTE_NOT_FOUND",
    requestId: req.requestId,
  });
};

/**
 * Async route handler wrapper
 * Catches errors in async route handlers and passes them to error middleware
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
