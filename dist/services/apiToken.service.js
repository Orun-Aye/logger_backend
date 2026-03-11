"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiTokenService = exports.ApiTokenValidationError = exports.ApiTokenNotFoundError = void 0;
const crypto_1 = __importDefault(require("crypto"));
const apiToken_model_1 = require("../models/apiToken.model");
class ApiTokenNotFoundError extends Error {
    constructor() {
        super("API token not found");
        this.name = "ApiTokenNotFoundError";
    }
}
exports.ApiTokenNotFoundError = ApiTokenNotFoundError;
class ApiTokenValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "ApiTokenValidationError";
    }
}
exports.ApiTokenValidationError = ApiTokenValidationError;
class ApiTokenService {
    /**
     * Generate a new personal API token.
     * Returns the raw token (shown once to the user) and the persisted DB record.
     */
    static async createToken(userId, name, scopes, expiresAt) {
        try {
            if (!name || name.trim().length === 0) {
                throw new ApiTokenValidationError("Token name is required");
            }
            if (!scopes || scopes.length === 0) {
                throw new ApiTokenValidationError("At least one scope is required");
            }
            // Check for duplicate names per user
            const existingToken = await apiToken_model_1.ApiTokenModel.findOne({
                userId,
                name: name.trim(),
                isActive: true,
            });
            if (existingToken) {
                throw new ApiTokenValidationError("A token with this name already exists");
            }
            // Generate random token: mt_ + 40 hex chars
            const rawToken = "mt_" + crypto_1.default.randomBytes(20).toString("hex");
            const tokenHash = crypto_1.default
                .createHash("sha256")
                .update(rawToken)
                .digest("hex");
            const tokenPrefix = rawToken.substring(0, 11); // "mt_" + first 8 hex chars
            const apiToken = await apiToken_model_1.ApiTokenModel.create({
                userId,
                name: name.trim(),
                tokenHash,
                tokenPrefix,
                scopes,
                expiresAt: expiresAt || null,
            });
            // Return the token object without the hash, plus the raw token (shown once)
            const tokenObj = apiToken.toObject();
            const { tokenHash: _hash, ...tokenWithoutHash } = tokenObj;
            return { token: tokenWithoutHash, rawToken };
        }
        catch (error) {
            if (error instanceof ApiTokenValidationError ||
                error instanceof ApiTokenNotFoundError) {
                throw error;
            }
            throw new Error(`Failed to create API token: ${error}`);
        }
    }
    /**
     * List all active tokens for a user.
     * Never returns the raw token or the full hash.
     */
    static async listTokens(userId) {
        try {
            return await apiToken_model_1.ApiTokenModel.find({ userId, isActive: true })
                .select("-tokenHash")
                .sort({ createdAt: -1 })
                .lean();
        }
        catch (error) {
            throw new Error(`Failed to list API tokens: ${error}`);
        }
    }
    /**
     * Revoke (deactivate) a token by ID.
     * Only the owning user can revoke their tokens.
     */
    static async revokeToken(tokenId, userId) {
        try {
            const token = await apiToken_model_1.ApiTokenModel.findOneAndUpdate({ _id: tokenId, userId }, { isActive: false }, { new: true }).select("-tokenHash");
            if (!token) {
                throw new ApiTokenNotFoundError();
            }
            return token;
        }
        catch (error) {
            if (error instanceof ApiTokenNotFoundError) {
                throw error;
            }
            throw new Error(`Failed to revoke API token: ${error}`);
        }
    }
    /**
     * Validate a raw token string during authentication.
     * Returns the token document (with userId and scopes) if valid, null otherwise.
     */
    static async validateToken(rawToken) {
        try {
            const tokenHash = crypto_1.default
                .createHash("sha256")
                .update(rawToken)
                .digest("hex");
            const token = await apiToken_model_1.ApiTokenModel.findOne({
                tokenHash,
                isActive: true,
            });
            if (!token) {
                return null;
            }
            // Check expiration
            if (token.expiresAt && token.expiresAt < new Date()) {
                token.isActive = false;
                await token.save();
                return null;
            }
            // Update lastUsedAt (fire-and-forget to avoid slowing auth)
            apiToken_model_1.ApiTokenModel.updateOne({ _id: token._id }, { lastUsedAt: new Date() }).exec();
            return token;
        }
        catch (error) {
            // On validation errors, return null rather than throwing
            // to avoid breaking authentication flow
            console.error("API token validation error:", error);
            return null;
        }
    }
}
exports.ApiTokenService = ApiTokenService;
