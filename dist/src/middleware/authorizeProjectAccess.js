"use strict";
// @ts-nocheck
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizeProjectAccess = authorizeProjectAccess;
const project_model_1 = require("../models/project.model");
async function authorizeProjectAccess(req, res, next) {
    const userId = req.userId || req.user?._id;
    const projectId = req.params.projectId;
    const project = await project_model_1.ProjectModel.findById(projectId).populate("teamMembers.user");
    if (!project) {
        return res.status(404).json({ message: "Project not found" });
    }
    const isOwner = project.ownerId?.toString() === userId;
    const isTeamMember = project.teamMembers.some((member) => member.user._id.toString() === userId);
    if (!isOwner && !isTeamMember) {
        return res.status(403).json({ status: "error", message: "Access denied" });
    }
    req.project = project;
    next();
}
