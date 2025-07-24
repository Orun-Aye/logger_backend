import { Request, Response } from "express";
import { Project } from "../models/project.model";
import { Log, LogLevel } from "../models/log.model";
import { CreateLogDto } from "../dtos/CreateLog.dto";


export const createLog = async (req: Request, res: Response) => {
  try {
    const { level, message, metadata } = req.body;
    const apiKey = req.headers["x-api-key"] as string;

    // Validate log level
    if (!Object.values(LogLevel).includes(level)) {
      return res.status(400).json({
        success: false,
        message: "Invalid log level",
      });
    }

    // Check if project exists
    const project = await Project.findOne({ apiKey });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const log = await Log.create({
      level,
      message,
      metadata,
      project: project._id,
    });

    res.status(201).json({
      success: true,
      message: "Log created successfully",
      data: log,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to log message",
      error,
    });
  }
};

export const getLogs = async (req: Request, res: Response) => {
  try {
    const apiKey = req.headers["x-api-key"] as string;

    // Check if project exists
    const project = await Project.findOne({ apiKey });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const logs = await Log.find({ project: project._id }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      message: "Logs retrieved successfully",
      data: logs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve logs",
      error,
    });
  }
};
