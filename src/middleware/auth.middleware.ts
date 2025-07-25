// @ts-nocheck


import { NextFunction, Request, Response } from "express";
import { ProjectModel } from "../models/project.model";


export async function authenticateApiKey(req: Request, res: Response, next: NextFunction) {
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey) {
        return res.status(401).json({
            status: 'error1',
            code: 'UNAUTHORIZED',
            message: 'API key is required'
        });
    }

    const project = await ProjectModel.findOne({ apiKey })
    if (!project) {
        return res.status(403).json({
            status: 'error',
            code: 'INVALID_API_KEY',
            message: 'The provided API key is invalid.'
        });
    }

    req.projectId = project._id.toString();  // Also set it on the request object for convenience
    next();
}