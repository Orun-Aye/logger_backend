import { Request, Response } from "express";
import { Project } from "../models/project.model";
import { nanoid } from "nanoid";

export const createProject = async (
  req: Request,
  res: Response
) => {
  try {
    const { name, description } = req.body;

    const project = await Project.create({
      name,
      apiKey: nanoid(32), 
      description,
    });

    res.status(201).json({
      message: "Project created successfully",
      data: project,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to create project", error });
  }
};
