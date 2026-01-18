// @ts-nocheck

import { NextFunction, Request, Response } from "express";
import { ProjectModel } from "../models/project.model";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

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

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
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
      status: "error1",
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

  req.projectId = project._id.toString(); // Also set it on the request object for convenience
  next();
}
