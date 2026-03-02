// src/errors/index.ts

/**
 * Base application error class
 * All custom errors should extend this class
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: any;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    details?: any,
    isOperational: boolean = true
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);

    // Set the prototype explicitly for proper instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Validation error (400)
 * Used when request data fails validation
 */
export class ValidationError extends AppError {
  constructor(message: string = "Validation failed", details?: any) {
    super(message, "VALIDATION_ERROR", 400, details);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Authentication error (401)
 * Used when authentication fails or token is invalid
 */
export class AuthError extends AppError {
  constructor(message: string = "Authentication failed", details?: any) {
    super(message, "AUTH_ERROR", 401, details);
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}

/**
 * Authorization error (403)
 * Used when user doesn't have permission for an action
 */
export class ForbiddenError extends AppError {
  constructor(message: string = "Access forbidden", details?: any) {
    super(message, "FORBIDDEN_ERROR", 403, details);
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

/**
 * Not found error (404)
 * Used when a resource is not found
 */
export class NotFoundError extends AppError {
  constructor(resource: string = "Resource", details?: any) {
    super(`${resource} not found`, "NOT_FOUND_ERROR", 404, details);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Conflict error (409)
 * Used when there's a conflict (e.g., duplicate resource)
 */
export class ConflictError extends AppError {
  constructor(message: string = "Resource already exists", details?: any) {
    super(message, "CONFLICT_ERROR", 409, details);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

/**
 * Rate limit error (429)
 * Used when rate limit is exceeded
 */
export class RateLimitError extends AppError {
  constructor(message: string = "Rate limit exceeded", details?: any) {
    super(message, "RATE_LIMIT_ERROR", 429, details);
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Internal server error (500)
 * Used for unexpected errors
 */
export class InternalError extends AppError {
  constructor(message: string = "Internal server error", details?: any) {
    super(message, "INTERNAL_ERROR", 500, details, false);
    Object.setPrototypeOf(this, InternalError.prototype);
  }
}

/**
 * Service unavailable error (503)
 * Used when a dependent service is unavailable
 */
export class ServiceUnavailableError extends AppError {
  constructor(service: string = "Service", details?: any) {
    super(`${service} is currently unavailable`, "SERVICE_UNAVAILABLE", 503, details);
    Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
  }
}

/**
 * Bad request error (400)
 * Used for general bad request scenarios
 */
export class BadRequestError extends AppError {
  constructor(message: string = "Bad request", details?: any) {
    super(message, "BAD_REQUEST_ERROR", 400, details);
    Object.setPrototypeOf(this, BadRequestError.prototype);
  }
}

/**
 * Database error (500)
 * Used for database-related errors
 */
export class DatabaseError extends AppError {
  constructor(message: string = "Database operation failed", details?: any) {
    super(message, "DATABASE_ERROR", 500, details, false);
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

/**
 * External service error (502)
 * Used when an external API/service fails
 */
export class ExternalServiceError extends AppError {
  constructor(service: string = "External service", details?: any) {
    super(`${service} request failed`, "EXTERNAL_SERVICE_ERROR", 502, details);
    Object.setPrototypeOf(this, ExternalServiceError.prototype);
  }
}
