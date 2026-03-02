"use strict";
// src/errors/index.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExternalServiceError = exports.DatabaseError = exports.BadRequestError = exports.ServiceUnavailableError = exports.InternalError = exports.RateLimitError = exports.ConflictError = exports.NotFoundError = exports.ForbiddenError = exports.AuthError = exports.ValidationError = exports.AppError = void 0;
/**
 * Base application error class
 * All custom errors should extend this class
 */
class AppError extends Error {
    code;
    statusCode;
    details;
    isOperational;
    constructor(message, code, statusCode, details, isOperational = true) {
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
exports.AppError = AppError;
/**
 * Validation error (400)
 * Used when request data fails validation
 */
class ValidationError extends AppError {
    constructor(message = "Validation failed", details) {
        super(message, "VALIDATION_ERROR", 400, details);
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}
exports.ValidationError = ValidationError;
/**
 * Authentication error (401)
 * Used when authentication fails or token is invalid
 */
class AuthError extends AppError {
    constructor(message = "Authentication failed", details) {
        super(message, "AUTH_ERROR", 401, details);
        Object.setPrototypeOf(this, AuthError.prototype);
    }
}
exports.AuthError = AuthError;
/**
 * Authorization error (403)
 * Used when user doesn't have permission for an action
 */
class ForbiddenError extends AppError {
    constructor(message = "Access forbidden", details) {
        super(message, "FORBIDDEN_ERROR", 403, details);
        Object.setPrototypeOf(this, ForbiddenError.prototype);
    }
}
exports.ForbiddenError = ForbiddenError;
/**
 * Not found error (404)
 * Used when a resource is not found
 */
class NotFoundError extends AppError {
    constructor(resource = "Resource", details) {
        super(`${resource} not found`, "NOT_FOUND_ERROR", 404, details);
        Object.setPrototypeOf(this, NotFoundError.prototype);
    }
}
exports.NotFoundError = NotFoundError;
/**
 * Conflict error (409)
 * Used when there's a conflict (e.g., duplicate resource)
 */
class ConflictError extends AppError {
    constructor(message = "Resource already exists", details) {
        super(message, "CONFLICT_ERROR", 409, details);
        Object.setPrototypeOf(this, ConflictError.prototype);
    }
}
exports.ConflictError = ConflictError;
/**
 * Rate limit error (429)
 * Used when rate limit is exceeded
 */
class RateLimitError extends AppError {
    constructor(message = "Rate limit exceeded", details) {
        super(message, "RATE_LIMIT_ERROR", 429, details);
        Object.setPrototypeOf(this, RateLimitError.prototype);
    }
}
exports.RateLimitError = RateLimitError;
/**
 * Internal server error (500)
 * Used for unexpected errors
 */
class InternalError extends AppError {
    constructor(message = "Internal server error", details) {
        super(message, "INTERNAL_ERROR", 500, details, false);
        Object.setPrototypeOf(this, InternalError.prototype);
    }
}
exports.InternalError = InternalError;
/**
 * Service unavailable error (503)
 * Used when a dependent service is unavailable
 */
class ServiceUnavailableError extends AppError {
    constructor(service = "Service", details) {
        super(`${service} is currently unavailable`, "SERVICE_UNAVAILABLE", 503, details);
        Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
    }
}
exports.ServiceUnavailableError = ServiceUnavailableError;
/**
 * Bad request error (400)
 * Used for general bad request scenarios
 */
class BadRequestError extends AppError {
    constructor(message = "Bad request", details) {
        super(message, "BAD_REQUEST_ERROR", 400, details);
        Object.setPrototypeOf(this, BadRequestError.prototype);
    }
}
exports.BadRequestError = BadRequestError;
/**
 * Database error (500)
 * Used for database-related errors
 */
class DatabaseError extends AppError {
    constructor(message = "Database operation failed", details) {
        super(message, "DATABASE_ERROR", 500, details, false);
        Object.setPrototypeOf(this, DatabaseError.prototype);
    }
}
exports.DatabaseError = DatabaseError;
/**
 * External service error (502)
 * Used when an external API/service fails
 */
class ExternalServiceError extends AppError {
    constructor(service = "External service", details) {
        super(`${service} request failed`, "EXTERNAL_SERVICE_ERROR", 502, details);
        Object.setPrototypeOf(this, ExternalServiceError.prototype);
    }
}
exports.ExternalServiceError = ExternalServiceError;
