"use strict";
// src/config/auth.config.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = generateToken;
exports.generateRefreshToken = generateRefreshToken;
exports.verifyToken = verifyToken;
exports.hashPassword = hashPassword;
exports.comparePassword = comparePassword;
exports.extractTokenFromHeader = extractTokenFromHeader;
exports.generateApiKey = generateApiKey;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const index_1 = require("./index");
/**
 * Generate JWT token
 */
function generateToken(payload) {
    return jsonwebtoken_1.default.sign(payload, index_1.config.jwt.secret, {
        expiresIn: index_1.config.jwt.expiry,
    });
}
/**
 * Generate refresh token
 */
function generateRefreshToken(payload) {
    return jsonwebtoken_1.default.sign(payload, index_1.config.jwt.secret, {
        expiresIn: index_1.config.jwt.refreshExpiry,
    });
}
/**
 * Verify JWT token
 */
function verifyToken(token) {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, index_1.config.jwt.secret);
        return decoded;
    }
    catch (error) {
        throw new Error("Invalid or expired token");
    }
}
/**
 * Hash password
 */
async function hashPassword(password) {
    return bcrypt_1.default.hash(password, index_1.config.security.bcryptRounds);
}
/**
 * Compare password with hash
 */
async function comparePassword(password, hash) {
    return bcrypt_1.default.compare(password, hash);
}
/**
 * Extract token from Authorization header
 */
function extractTokenFromHeader(authHeader) {
    if (!authHeader)
        return null;
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
        return null;
    }
    return parts[1];
}
/**
 * Generate API key (for SDK authentication)
 */
function generateApiKey() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const length = 32;
    let apiKey = "";
    for (let i = 0; i < length; i++) {
        apiKey += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `mk_${apiKey}`; // Monita Key prefix
}
