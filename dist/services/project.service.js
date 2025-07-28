"use strict";
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
exports.ProjectService = exports.ProjectValidationError = exports.ProjectNotFoundError = void 0;
const project_model_1 = require("../models/project.model");
const uuid_1 = require("uuid");
const mongoose_1 = require("mongoose");
// Custom error classes for better error handling
class ProjectNotFoundError extends Error {
    constructor(id) {
        super(`Project with ID ${id} not found`);
        this.name = "ProjectNotFoundError";
    }
}
exports.ProjectNotFoundError = ProjectNotFoundError;
class ProjectValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "ProjectValidationError";
    }
}
exports.ProjectValidationError = ProjectValidationError;
class ProjectService {
    // Input validation helper
    static validateObjectId(id) {
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            throw new ProjectValidationError(`Invalid project ID format: ${id}`);
        }
    }
    // Validation for create data
    static validateCreateData(data) {
        if (!data.name || data.name.trim().length === 0) {
            throw new ProjectValidationError("Project name is required");
        }
        if (data.name.length > 100) {
            throw new ProjectValidationError("Project name cannot exceed 100 characters");
        }
    }
    static createProject(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.validateCreateData(data);
                // Check for duplicate names
                const existingProject = yield project_model_1.ProjectModel.findOne({
                    name: data.name.trim(),
                });
                if (existingProject) {
                    throw new ProjectValidationError("Project with this name already exists");
                }
                const apiKey = (0, uuid_1.v4)();
                const project = new project_model_1.ProjectModel(Object.assign(Object.assign({}, data), { name: data.name.trim(), ownerId: data.ownerId, teamMembers: [{ user: data.ownerId, role: "admin" }], apiKey, createdAt: new Date(), updatedAt: new Date() }));
                const savedProject = yield project.save();
                // Return only necessary fields
                return {
                    id: savedProject._id,
                    name: savedProject.name,
                    description: savedProject.description,
                    apiKey: savedProject.apiKey,
                    createdAt: savedProject.createdAt,
                    updatedAt: savedProject.updatedAt,
                };
            }
            catch (error) {
                if (error instanceof ProjectValidationError) {
                    throw error;
                }
                throw new Error(`Failed to create project: ${error}`);
            }
        });
    }
    static getAllProjects() {
        return __awaiter(this, arguments, void 0, function* (options = {}) {
            try {
                const { page = 1, limit = 10, sortBy = "createdAt", sortOrder = "desc", } = options;
                const skip = (page - 1) * limit;
                const sort = {
                    [sortBy]: sortOrder === "desc" ? -1 : 1,
                };
                const [projects, total] = yield Promise.all([
                    project_model_1.ProjectModel.find()
                        .select("-__v") // Exclude version key
                        .sort(sort)
                        .skip(skip)
                        .limit(limit)
                        .lean(), // Better performance for read-only operations
                    project_model_1.ProjectModel.countDocuments(),
                ]);
                return {
                    projects,
                    pagination: {
                        current: page,
                        total: Math.ceil(total / limit),
                        count: projects.length,
                        order: sortOrder,
                        totalRecords: total,
                    },
                };
            }
            catch (error) {
                throw new Error(`Failed to fetch projects: ${error}`);
            }
        });
    }
    static getProjectsByUser(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, options = {}) {
            try {
                const { page = 1, limit = 10, sortBy = "createdAt", sortOrder = "desc", searchBy = 'owner' } = options;
                const skip = (page - 1) * limit;
                const sort = {
                    [sortBy]: sortOrder === "desc" ? -1 : 1,
                };
                this.validateObjectId(userId);
                const userObjectId = new mongoose_1.Types.ObjectId(userId);
                let queryCondition;
                if (searchBy === 'owner') {
                    queryCondition = { ownerId: userObjectId };
                }
                else if (searchBy === 'teamMember') {
                    queryCondition = { 'teamMembers.user': userObjectId };
                }
                else { // 'both'
                    queryCondition = {
                        $or: [
                            { ownerId: userObjectId },
                            { 'teamMembers.user': userObjectId },
                        ],
                    };
                }
                const [projects, total] = yield Promise.all([
                    project_model_1.ProjectModel.find(queryCondition)
                        .select("-__v")
                        .sort(sort)
                        .skip(skip)
                        .limit(limit)
                        .lean(),
                    project_model_1.ProjectModel.countDocuments(queryCondition)
                ]);
                return {
                    projects,
                    pagination: {
                        current: page,
                        total: Math.ceil(total / limit),
                        count: projects.length,
                        order: sortOrder,
                        totalRecords: total
                    }
                };
            }
            catch (error) {
                throw new Error(`Failed to fetch projects: ${error}`);
            }
        });
    }
    static getProjectById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.validateObjectId(id);
                const project = yield project_model_1.ProjectModel.findById(id).select("-__v").lean();
                if (!project) {
                    throw new ProjectNotFoundError(id);
                }
                return project;
            }
            catch (error) {
                if (error instanceof ProjectNotFoundError ||
                    error instanceof ProjectValidationError) {
                    throw error;
                }
                throw new Error(`Failed to fetch project: ${error}`);
            }
        });
    }
    static updateProject(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.validateObjectId(id);
                // Check if project exists first
                const existingProject = yield project_model_1.ProjectModel.findById(id);
                if (!existingProject) {
                    throw new ProjectNotFoundError(id);
                }
                // Validate name if provided
                if (data.name !== undefined) {
                    if (!data.name || data.name.trim().length === 0) {
                        throw new ProjectValidationError("Project name cannot be empty");
                    }
                    if (data.name.length > 100) {
                        throw new ProjectValidationError("Project name cannot exceed 100 characters");
                    }
                    // Check for duplicate names (excluding current project)
                    const duplicateProject = yield project_model_1.ProjectModel.findOne({
                        name: data.name.trim(),
                        _id: { $ne: id },
                    });
                    if (duplicateProject) {
                        throw new ProjectValidationError("Project with this name already exists");
                    }
                }
                const updateData = Object.assign(Object.assign(Object.assign({}, data), (data.name && { name: data.name.trim() })), { updatedAt: new Date() });
                const updatedProject = yield project_model_1.ProjectModel.findByIdAndUpdate(id, updateData, {
                    new: true,
                    runValidators: true,
                    select: "-__v",
                }).lean();
                return updatedProject;
            }
            catch (error) {
                if (error instanceof ProjectNotFoundError ||
                    error instanceof ProjectValidationError) {
                    throw error;
                }
                throw new Error(`Failed to update project: ${error}`);
            }
        });
    }
    static deleteProject(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.validateObjectId(id);
                const deletedProject = yield project_model_1.ProjectModel.findByIdAndDelete(id);
                if (!deletedProject) {
                    throw new ProjectNotFoundError(id);
                }
                return { success: true, deletedId: id };
            }
            catch (error) {
                if (error instanceof ProjectNotFoundError ||
                    error instanceof ProjectValidationError) {
                    throw error;
                }
                throw new Error(`Failed to delete project: ${error}`);
            }
        });
    }
    static regenerateApiKey(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.validateObjectId(id);
                const newKey = (0, uuid_1.v4)();
                const updatedProject = yield project_model_1.ProjectModel.findByIdAndUpdate(id, {
                    apiKey: newKey,
                    updatedAt: new Date(),
                }, { new: true });
                if (!updatedProject) {
                    throw new ProjectNotFoundError(id);
                }
                return newKey;
            }
            catch (error) {
                if (error instanceof ProjectNotFoundError ||
                    error instanceof ProjectValidationError) {
                    throw error;
                }
                throw new Error(`Failed to regenerate API key: ${error}`);
            }
        });
    }
    static getProjectStats(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.validateObjectId(id);
                const project = yield project_model_1.ProjectModel.findById(id)
                    .select("logCount alertRulesCount lastIngestedAt name")
                    .lean();
                if (!project) {
                    throw new ProjectNotFoundError(id);
                }
                return {
                    projectId: id,
                    projectName: project.name,
                    logCount: project.logCount || 0,
                    alertRulesCount: project.alertRuleCount || 0,
                    lastIngestedAt: project.lastIngestedAt,
                    statsGeneratedAt: new Date(),
                };
            }
            catch (error) {
                if (error instanceof ProjectNotFoundError ||
                    error instanceof ProjectValidationError) {
                    throw error;
                }
                throw new Error(`Failed to get project stats: ${error}`);
            }
        });
    }
    // Additional utility methods
    static getProjectByApiKey(apiKey) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!apiKey) {
                    throw new ProjectValidationError("API key is required");
                }
                const project = yield project_model_1.ProjectModel.findOne({ apiKey })
                    .select("-__v")
                    .lean();
                if (!project) {
                    throw new ProjectNotFoundError(`project with API key`);
                }
                return project;
            }
            catch (error) {
                if (error instanceof ProjectNotFoundError ||
                    error instanceof ProjectValidationError) {
                    throw error;
                }
                throw new Error(`Failed to find project by API key: ${error}`);
            }
        });
    }
    static searchProjects(query_1) {
        return __awaiter(this, arguments, void 0, function* (query, options = {}) {
            try {
                const { limit = 10 } = options;
                if (!query || query.trim().length === 0) {
                    throw new ProjectValidationError("Search query is required");
                }
                const searchRegex = new RegExp(query.trim(), "i");
                const projects = yield project_model_1.ProjectModel.find({
                    $or: [{ name: searchRegex }, { description: searchRegex }],
                })
                    .select("-__v -apiKey") // Don't expose API keys in search
                    .limit(limit)
                    .lean();
                return {
                    query: query.trim(),
                    results: projects,
                    count: projects.length,
                };
            }
            catch (error) {
                if (error instanceof ProjectValidationError) {
                    throw error;
                }
                throw new Error(`Failed to search projects: ${error}`);
            }
        });
    }
    static addTeamMember(projectId, userId, role) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.validateObjectId(projectId);
                this.validateObjectId(userId);
                const project = yield project_model_1.ProjectModel.findById(projectId);
                if (!project) {
                    throw new ProjectNotFoundError(projectId);
                }
                // Check if user is already a team member
                const existingMember = project.teamMembers.find((member) => member.user.toString() === userId);
                if (existingMember) {
                    throw new ProjectValidationError("User is already a team member of this project");
                }
                project.teamMembers.push({ user: new mongoose_1.Types.ObjectId(userId), role });
                project.updatedAt = new Date();
                const updatedProject = yield project.save();
                return {
                    projectId: updatedProject._id,
                    teamMember: {
                        userId: userId,
                        role: role,
                    },
                };
            }
            catch (error) {
                if (error instanceof ProjectNotFoundError ||
                    error instanceof ProjectValidationError) {
                    throw error;
                }
                throw new Error(`Failed to add team member: ${error}`);
            }
        });
    }
    static removeTeamMember(projectId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.validateObjectId(projectId);
                this.validateObjectId(userId);
                const project = yield project_model_1.ProjectModel.findById(projectId);
                if (!project) {
                    throw new ProjectNotFoundError(projectId);
                }
                const memberIndex = project.teamMembers.findIndex((member) => member.user.toString() === userId);
                if (memberIndex === -1) {
                    throw new ProjectValidationError("User is not a team member of this project");
                }
                project.teamMembers.splice(memberIndex, 1);
                project.updatedAt = new Date();
                const updatedProject = yield project.save();
                return {
                    projectId: updatedProject._id,
                    removedUserId: userId,
                };
            }
            catch (error) {
                if (error instanceof ProjectNotFoundError ||
                    error instanceof ProjectValidationError) {
                    throw error;
                }
                throw new Error(`Failed to remove team member: ${error}`);
            }
        });
    }
    static updateTeamMemberRole(projectId, userId, role) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.validateObjectId(projectId);
                this.validateObjectId(userId);
                const project = yield project_model_1.ProjectModel.findById(projectId);
                if (!project) {
                    throw new ProjectNotFoundError(projectId);
                }
                const member = project.teamMembers.find((member) => member.user.toString() === userId);
                if (!member) {
                    throw new ProjectValidationError("User is not a team member of this project");
                }
                member.role = role;
                project.updatedAt = new Date();
                const updatedProject = yield project.save();
                return {
                    projectId: updatedProject._id,
                    updatedUser: {
                        userId: userId,
                        role: role,
                    },
                };
            }
            catch (error) {
                if (error instanceof ProjectNotFoundError ||
                    error instanceof ProjectValidationError) {
                    throw error;
                }
                throw new Error(`Failed to update team member role: ${error}`);
            }
        });
    }
}
exports.ProjectService = ProjectService;
