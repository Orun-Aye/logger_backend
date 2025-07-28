"use strict";
// @ts-nocheck
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizeProjectAccess = authorizeProjectAccess;
const project_model_1 = require("../models/project.model");
function authorizeProjectAccess(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const userId = req.userId || ((_a = req.user) === null || _a === void 0 ? void 0 : _a._id);
        const projectId = req.params.projectId;
        const project = yield project_model_1.ProjectModel.findById(projectId).populate("teamMembers.user");
        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }
        const isOwner = ((_b = project.ownerId) === null || _b === void 0 ? void 0 : _b.toString()) === userId;
        const isTeamMember = project.teamMembers.some((member) => member.user._id.toString() === userId);
        if (!isOwner && !isTeamMember) {
            return res.status(403).json({ status: "error", message: "Access denied" });
        }
        req.project = project;
        next();
    });
}
