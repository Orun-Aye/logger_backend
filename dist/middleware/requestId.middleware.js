"use strict";
// src/middleware/requestId.middleware.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestIdMiddleware = void 0;
const uuid_1 = require("uuid");
/**
 * Middleware to generate and attach a unique request ID
 * This ID can be used for request correlation in logs and error tracking
 */
const requestIdMiddleware = (req, res, next) => {
    // Check if request ID is already provided (e.g., from load balancer)
    const existingId = req.headers["x-request-id"];
    // Use existing ID or generate a new one
    const requestId = existingId || (0, uuid_1.v4)();
    // Attach to request object
    req.requestId = requestId;
    // Send in response headers for client-side correlation
    res.setHeader("X-Request-ID", requestId);
    next();
};
exports.requestIdMiddleware = requestIdMiddleware;
