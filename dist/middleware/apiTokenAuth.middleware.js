"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateApiToken = authenticateApiToken;
exports.requireScope = requireScope;
const apiToken_service_1 = require("../services/apiToken.service");
/**
 * Middleware that checks for personal API tokens (mt_ prefix).
 *
 * If the Authorization header contains a Bearer token starting with "mt_",
 * this middleware validates it and sets req.userId and req.tokenScopes.
 *
 * If the token does not start with "mt_", it calls next() so that the
 * standard JWT verifyToken middleware can handle it.
 */
async function authenticateApiToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        // No auth header — let the next middleware handle it
        next();
        return;
    }
    const rawToken = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : authHeader;
    // Only handle tokens with the mt_ prefix
    if (!rawToken.startsWith("mt_")) {
        // Not a personal API token — pass through to JWT auth
        next();
        return;
    }
    try {
        const token = await apiToken_service_1.ApiTokenService.validateToken(rawToken);
        if (!token) {
            res.status(401).json({
                status: "error",
                code: "INVALID_TOKEN",
                message: "Invalid, expired, or revoked API token",
            });
            return;
        }
        // Set user context from the token
        req.userId = token.userId.toString();
        req.tokenScopes = token.scopes;
        next();
    }
    catch (error) {
        res.status(500).json({
            status: "error",
            code: "SERVER_ERROR",
            message: "Failed to validate API token",
        });
    }
}
/**
 * Scope-checking middleware factory.
 * Use after authenticateApiToken or verifyToken to ensure the request
 * has the required scope(s).
 *
 * JWT-authenticated requests (no tokenScopes) are always allowed —
 * scopes only apply to personal API tokens.
 */
function requireScope(...requiredScopes) {
    return (req, res, next) => {
        // If no tokenScopes, this is a JWT-authenticated request — allow
        if (!req.tokenScopes) {
            next();
            return;
        }
        // Admin scope grants access to everything
        if (req.tokenScopes.includes("admin")) {
            next();
            return;
        }
        // Check if the token has at least one of the required scopes
        const hasScope = requiredScopes.some((scope) => req.tokenScopes.includes(scope));
        if (!hasScope) {
            res.status(403).json({
                status: "error",
                code: "INSUFFICIENT_SCOPE",
                message: `This action requires one of the following scopes: ${requiredScopes.join(", ")}`,
            });
            return;
        }
        next();
    };
}
