import { NextFunction, Request, Response } from "express";
import { ProjectModel } from "../models/project.model";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { ApiTokenService } from "../services/apiToken.service";

dotenv.config();

interface JwtPayload {
  userId: string;
}

export async function verifyToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
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

  // If the token starts with "mt_", validate as a personal API token
  if (token.startsWith("mt_")) {
    try {
      const apiToken = await ApiTokenService.validateToken(token);
      if (!apiToken) {
        return res.status(401).json({
          status: "error",
          code: "INVALID_TOKEN",
          message: "Invalid, expired, or revoked API token",
        });
      }
      req.userId = apiToken.userId.toString();
      req.tokenScopes = apiToken.scopes;
      return next();
    } catch (error) {
      return res.status(500).json({
        status: "error",
        code: "SERVER_ERROR",
        message: "Failed to validate API token",
      });
    }
  }

  // Otherwise, validate as a JWT
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({
      status: "error",
      code: "SERVER_ERROR",
      message: "Authentication service misconfigured",
    });
  }

  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;
    req.userId = decoded.userId;
  } catch (error) {
    return res.status(401).json({
      status: "error",
      code: "INVALID_TOKEN",
      message: "Invalid or expired token",
    });
  }
  next();
}

export async function authenticateApiKey(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const apiKey = req.headers["x-api-key"] as string;
  if (!apiKey) {
    return res.status(401).json({
      status: "error",
      code: "UNAUTHORIZED",
      message: "API key is required",
    });
  }

  const project = await ProjectModel.findOne({ apiKey });
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
