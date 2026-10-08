import { Request, Response, NextFunction } from "express";
import { ProjectModel } from "../models/project.model";
import { Types } from "mongoose";

const memberId = (member: { user?: any }) =>
  String(member.user?._id ?? member.user ?? "");

/**
 * Lets the request through only for the project's owner or a team member,
 * and puts the project on req.project. Use after verifyToken on every JWT
 * route that takes :projectId.
 */
export async function authorizeProjectAccess(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const userId = req.userId;
  const projectId = req.params.projectId;

  if (!Types.ObjectId.isValid(projectId)) {
    return res.status(404).json({ status: "error", message: "Project not found" });
  }

  const project = await ProjectModel.findById(projectId).populate(
    "teamMembers.user"
  );
  if (!project) {
    return res.status(404).json({ status: "error", message: "Project not found" });
  }

  const isOwner = project.ownerId?.toString() === userId;
  // A member whose user was deleted populates to null, so compare ids defensively
  const isTeamMember = project.teamMembers.some(
    (member) => memberId(member) === userId
  );

  if (!isOwner && !isTeamMember) {
    return res.status(403).json({ status: "error", message: "Access denied" });
  }

  req.project = project;
  next();
}

/**
 * For changes to a project: the owner, or a team member with the admin role.
 * Runs authorizeProjectAccess first, so it can be used on its own.
 */
export async function requireProjectAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  await authorizeProjectAccess(req, res, () => {
    const project = req.project!;
    const userId = req.userId;
    const isOwner = project.ownerId?.toString() === userId;
    const isAdmin = project.teamMembers.some(
      (member) => memberId(member) === userId && member.role === "admin"
    );
    if (!isOwner && !isAdmin) {
      return res
        .status(403)
        .json({ status: "error", message: "Only the project owner or an admin can do this" });
    }
    next();
  });
}
