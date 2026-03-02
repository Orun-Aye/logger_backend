"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = verifyToken;
exports.authenticateApiKey = authenticateApiKey;
const project_model_1 = require("../models/project.model");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
async function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({
            status: "error",
            code: "UNAUTHORIZED",
            message: "No token provided",
        });
    }
    // Extract token from "Bearer <token>" format
    const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : authHeader;
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        return res.status(500).json({
            status: "error",
            code: "SERVER_ERROR",
            message: "Authentication service misconfigured",
        });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        req.userId = decoded.userId;
    }
    catch (error) {
        return res.status(401).json({
            status: "error",
            code: "INVALID_TOKEN",
            message: "Invalid or expired token",
        });
    }
    next();
}
async function authenticateApiKey(req, res, next) {
    const apiKey = req.headers["x-api-key"];
    if (!apiKey) {
        return res.status(401).json({
            status: "error",
            code: "UNAUTHORIZED",
            message: "API key is required",
        });
    }
    const project = await project_model_1.ProjectModel.findOne({ apiKey });
    if (!project) {
        return res.status(403).json({
            status: "error",
            code: "INVALID_API_KEY",
            message: "The provided API key is invalid.",
        });
    }
    req.projectId = project._id.toString();
    next();
}
