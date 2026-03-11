"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiTokenController = void 0;
const apiToken_service_1 = require("../services/apiToken.service");
const apiToken_model_1 = require("../models/apiToken.model");
class ApiTokenController {
    static handleError(error, res, defaultMessage) {
        console.error(`ApiTokenController Error: ${error.message}`, error.stack);
        if (error instanceof apiToken_service_1.ApiTokenValidationError) {
            return res.status(400).json({
                status: "error",
                message: error.message,
                errors: [error.message],
            });
        }
        if (error instanceof apiToken_service_1.ApiTokenNotFoundError) {
            return res.status(404).json({
                status: "error",
                message: error.message,
                errors: [error.message],
            });
        }
        return res.status(500).json({
            status: "error",
            message: defaultMessage,
            errors: [error.message],
        });
    }
    /**
     * POST /api/v1/tokens
     * Create a new personal API token. Returns the raw token exactly once.
     */
    static async createToken(req, res) {
        try {
            const { name, scopes, expiresAt } = req.body;
            if (!name || typeof name !== "string") {
                return res.status(400).json({
                    status: "error",
                    message: "Token name is required",
                });
            }
            if (!scopes || !Array.isArray(scopes) || scopes.length === 0) {
                return res.status(400).json({
                    status: "error",
                    message: "At least one scope is required",
                });
            }
            // Validate scopes
            const invalidScopes = scopes.filter((s) => !apiToken_model_1.API_TOKEN_SCOPES.includes(s));
            if (invalidScopes.length > 0) {
                return res.status(400).json({
                    status: "error",
                    message: `Invalid scopes: ${invalidScopes.join(", ")}`,
                });
            }
            // Parse expiration
            let parsedExpiry = null;
            if (expiresAt) {
                parsedExpiry = new Date(expiresAt);
                if (isNaN(parsedExpiry.getTime())) {
                    return res.status(400).json({
                        status: "error",
                        message: "Invalid expiration date",
                    });
                }
                if (parsedExpiry <= new Date()) {
                    return res.status(400).json({
                        status: "error",
                        message: "Expiration date must be in the future",
                    });
                }
            }
            const result = await apiToken_service_1.ApiTokenService.createToken(req.userId, name, scopes, parsedExpiry);
            return res.status(201).json({
                status: "success",
                message: "API token created successfully. Copy the token now — it will not be shown again.",
                data: {
                    ...result.token,
                    rawToken: result.rawToken,
                },
            });
        }
        catch (error) {
            return ApiTokenController.handleError(error, res, "Failed to create API token");
        }
    }
    /**
     * GET /api/v1/tokens
     * List all active tokens for the authenticated user.
     */
    static async listTokens(req, res) {
        try {
            const tokens = await apiToken_service_1.ApiTokenService.listTokens(req.userId);
            return res.status(200).json({
                status: "success",
                data: tokens,
            });
        }
        catch (error) {
            return ApiTokenController.handleError(error, res, "Failed to list API tokens");
        }
    }
    /**
     * DELETE /api/v1/tokens/:tokenId
     * Revoke (deactivate) a token.
     */
    static async revokeToken(req, res) {
        try {
            const { tokenId } = req.params;
            if (!tokenId) {
                return res.status(400).json({
                    status: "error",
                    message: "Token ID is required",
                });
            }
            const token = await apiToken_service_1.ApiTokenService.revokeToken(tokenId, req.userId);
            return res.status(200).json({
                status: "success",
                message: "API token revoked successfully",
                data: token,
            });
        }
        catch (error) {
            return ApiTokenController.handleError(error, res, "Failed to revoke API token");
        }
    }
}
exports.ApiTokenController = ApiTokenController;
