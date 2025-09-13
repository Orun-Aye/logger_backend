"use strict";
// @ts-nocheck
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
    const token = req.headers.authorization;
    if (!token) {
        return res.status(401).json({
            status: "error",
            code: "UNAUTHORIZED",
            message: "No token provided",
        });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
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
            status: "error1",
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
    req.projectId = project._id.toString(); // Also set it on the request object for convenience
    next();
}
