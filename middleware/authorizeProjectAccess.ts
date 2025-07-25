// @ts-nocheck

import { Request, Response, NextFunction } from "express";
import { ProjectModel } from "../src/models/project.model";
import { Types } from "mongoose";

export async function authorizeProjectAccess(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const userId = req.body.userId || req.user?._id;
  const projectId = req.params.projectId;

  const project = await ProjectModel.findById(projectId).populate(
    "teamMembers.user"
  );
  if (!project) {
    return res.status(404).json({ message: "Project not found" });
  }

  const isOwner = project.ownerId?.toString() === userId;
  const isTeamMember = project.teamMembers.some(
    (member) => member.user._id.toString() === userId
  );

    if (!isOwner && !isTeamMember) {
        return res.status(403).json({ status: "error", message: "Access denied" });
    }

    req.project = project;
    next()
}
