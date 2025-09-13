"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitMiddleware = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const rateLimitMiddleware = (options) => {
    return (0, express_rate_limit_1.default)({
        windowMs: options.windowMs,
        max: options.max,
        message: {
            success: false,
            error: options.message
        },
        standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
        legacyHeaders: false, // Disable the `X-RateLimit-*` headers
        skipSuccessfulRequests: options.skipSuccessfulRequests || false,
        keyGenerator: options.keyGenerator || (async (req) => req.ip),
        handler: (req, res) => {
            res.status(429).json({
                success: false,
                error: options.message,
                retryAfter: Math.round(options.windowMs / 1000)
            });
        }
    });
};
exports.rateLimitMiddleware = rateLimitMiddleware;
