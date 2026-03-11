"use strict";
// src/middleware/bodyLimit.middleware.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.bodyLimits = exports.bodyLimitMiddleware = void 0;
/**
 * Middleware to enforce request body size limits
 * Especially important for log ingestion to prevent abuse
 */
const bodyLimitMiddleware = (maxSizeBytes) => {
    return (req, res, next) => {
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
exports.bodyLimitMiddleware = bodyLimitMiddleware;
/**
 * Preset middlewares for common limits
 */
exports.bodyLimits = {
    /**
     * Standard limit for most endpoints (1MB)
     */
    standard: (0, exports.bodyLimitMiddleware)(1024 * 1024), // 1MB
    /**
     * Generous limit for log ingestion (10MB for batch uploads)
     */
    logs: (0, exports.bodyLimitMiddleware)(10 * 1024 * 1024), // 10MB
    /**
     * Strict limit for auth endpoints (100KB)
     */
    auth: (0, exports.bodyLimitMiddleware)(100 * 1024), // 100KB
    /**
     * Minimal limit for simple operations (50KB)
     */
    minimal: (0, exports.bodyLimitMiddleware)(50 * 1024), // 50KB
};
