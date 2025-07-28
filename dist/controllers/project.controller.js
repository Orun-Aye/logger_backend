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
exports.ProjectController = void 0;
const project_service_1 = require("../services/project.service");
class ProjectController {
    // Centralized error handler
    static handleError(error, res, defaultMessage) {
        console.error(`ProjectController Error: ${error.message}`, error.stack);
        if (error instanceof project_service_1.ProjectValidationError) {
            return res.status(400).json({
                status: "error",
                message: error.message,
                errors: [error.message],
            });
        }
        if (error instanceof project_service_1.ProjectNotFoundError) {
            return res.status(404).json({
                status: "error",
                message: error.message,
            });
        }
        // Database/MongoDB specific errors
        if (error.name === "ValidationError") {
            return res.status(400).json({
                status: "error",
                message: "Validation failed",
                errors: Object.values(error.errors).map((err) => err.message),
            });
        }
        if (error.name === "CastError") {
            return res.status(400).json({
                status: "error",
                message: "Invalid ID format",
            });
        }
        // Generic server error
        return res.status(500).json({
            status: "error",
            message: defaultMessage,
        });
    }
    // Input validation helper
    static validatePaginationParams(req) {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10)); // Cap at 100
        const sortBy = req.query.sortBy || "createdAt";
        const sortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";
        return { page, limit, sortBy, sortOrder };
    }
    static create(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const projectData = req.body;
                const payload = Object.assign(Object.assign({}, projectData), { ownerId: req.userId });
                const project = yield project_service_1.ProjectService.createProject(payload);
                return res.status(201).json({
                    status: "success",
                    message: "Project created successfully",
                    data: project,
                });
            }
            catch (error) {
                return ProjectController.handleError(error, res, "Failed to create project1");
            }
        });
    }
    static getAll(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const paginationParams = ProjectController.validatePaginationParams(req);
                const result = yield project_service_1.ProjectService.getAllProjects(paginationParams);
                return res.status(200).json({
                    status: "success",
                    message: "Projects fetched successfully",
                    data: result.projects,
                    meta: {
                        pagination: result.pagination,
                    },
                });
            }
            catch (error) {
                return ProjectController.handleError(error, res, "Failed to fetch projects");
            }
        });
    }
    static getByUser(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const paginationParams = ProjectController.validatePaginationParams(req);
                const { id } = req.params;
                const result = yield project_service_1.ProjectService.getProjectsByUser(id, paginationParams);
            }
            catch (error) {
            }
        });
    }
    static getById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const project = yield project_service_1.ProjectService.getProjectById(id);
                return res.status(200).json({
                    status: "success",
                    message: "Project fetched successfully",
                    data: project,
                });
            }
            catch (error) {
                return ProjectController.handleError(error, res, "Failed to fetch project");
            }
        });
    }
    static updateById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const updateData = req.body;
                const updatedProject = yield project_service_1.ProjectService.updateProject(id, updateData);
                return res.status(200).json({
                    status: "success",
                    message: "Project updated successfully",
                    data: updatedProject,
                });
            }
            catch (error) {
                return ProjectController.handleError(error, res, "Failed to update project");
            }
        });
    }
    static delete(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                yield project_service_1.ProjectService.deleteProject(id);
                return res.status(204).send();
            }
            catch (error) {
                // For delete operations that fail, return error response instead of 204
                if (error instanceof project_service_1.ProjectNotFoundError) {
                    return res.status(404).json({
                        status: "error",
                        message: error.message,
                    });
                }
                return ProjectController.handleError(error, res, "Failed to delete project");
            }
        });
    }
    static regenerateApiKey(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const newApiKey = yield project_service_1.ProjectService.regenerateApiKey(id);
                return res.status(200).json({
                    status: "success",
                    message: "API key regenerated successfully",
                    data: {
                        projectId: id,
                        apiKey: newApiKey,
                    },
                });
            }
            catch (error) {
                return ProjectController.handleError(error, res, "Failed to regenerate API key");
            }
        });
    }
    static getProjectStats(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const stats = yield project_service_1.ProjectService.getProjectStats(id);
                return res.status(200).json({
                    status: "success",
                    message: "Project stats fetched successfully",
                    data: stats,
                });
            }
            catch (error) {
                return ProjectController.handleError(error, res, "Failed to fetch project stats");
            }
        });
    }
    static addTeamMember(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { userId, role } = req.body;
                const projectId = req.params.projectId;
                if (!userId || !role) {
                    return res.status(400).json({
                        status: "error",
                        message: "userId and role are required",
                    });
                }
                const updatedProject = yield project_service_1.ProjectService.addTeamMember(projectId, userId, role);
                return res.status(200).json({
                    status: "success",
                    message: "Team member added successfully",
                    data: updatedProject,
                });
            }
            catch (error) {
                return ProjectController.handleError(error, res, "Failed to add team member");
            }
        });
    }
    static removeTeamMember(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { userId } = req.body;
                const projectId = req.params.projectId;
                if (!userId) {
                    return res.status(400).json({
                        status: "error",
                        message: "userId is required",
                    });
                }
                const updatedProject = yield project_service_1.ProjectService.removeTeamMember(projectId, userId);
                return res.status(200).json({
                    status: "success",
                    message: "Team member removed successfully",
                    data: updatedProject,
                });
            }
            catch (error) {
                return ProjectController.handleError(error, res, "Failed to remove team member");
            }
        });
    }
    static updateTeamMemberRole(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { userId, role } = req.body;
                const projectId = req.params.projectId;
                if (!userId || !role) {
                    return res.status(400).json({
                        status: "error",
                        message: "userId and role are required",
                    });
                }
                const updatedProject = yield project_service_1.ProjectService.updateTeamMemberRole(projectId, userId, role);
                return res.status(200).json({
                    status: "success",
                    message: "Team member role updated successfully",
                    data: updatedProject,
                });
            }
            catch (error) {
                return ProjectController.handleError(error, res, "Failed to update team member role");
            }
        });
    }
    // Additional endpoints based on improved service
    static searchProjects(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { q: query } = req.query;
                const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
                if (!query || typeof query !== "string") {
                    return res.status(400).json({
                        status: "error",
                        message: "Search query parameter 'q' is required",
                    });
                }
                const results = yield project_service_1.ProjectService.searchProjects(query, { limit });
                return res.status(200).json({
                    status: "success",
                    message: "Search completed successfully",
                    data: results.results,
                    meta: {
                        query: results.query,
                        count: results.count,
                        limit,
                    },
                });
            }
            catch (error) {
                return ProjectController.handleError(error, res, "Failed to search projects");
            }
        });
    }
    static getProjectByApiKey(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const apiKey = req.headers["x-api-key"] || req.query.apiKey;
                if (!apiKey) {
                    return res.status(400).json({
                        status: "error",
                        message: "API key is required (provide via x-api-key header or apiKey query parameter)",
                    });
                }
                const project = yield project_service_1.ProjectService.getProjectByApiKey(apiKey);
                return res.status(200).json({
                    status: "success",
                    message: "Project found",
                    data: project,
                });
            }
            catch (error) {
                return ProjectController.handleError(error, res, "Failed to find project");
            }
        });
    }
    // Bulk operations
    static bulkDelete(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { ids } = req.body;
                if (!Array.isArray(ids) || ids.length === 0) {
                    return res.status(400).json({
                        status: "error",
                        message: "Array of project IDs is required",
                    });
                }
                if (ids.length > 50) {
                    return res.status(400).json({
                        status: "error",
                        message: "Cannot delete more than 50 projects at once",
                    });
                }
                const results = {
                    deleted: [],
                    failed: [],
                };
                // Process deletions with error handling for each
                for (const id of ids) {
                    try {
                        yield project_service_1.ProjectService.deleteProject(id);
                        results.deleted.push(id);
                    }
                    catch (error) {
                        results.failed.push({
                            id,
                            error: error instanceof Error ? error.message : "Unknown error",
                        });
                    }
                }
                return res.status(200).json({
                    status: "success",
                    message: `Bulk delete completed. ${results.deleted.length} deleted, ${results.failed.length} failed`,
                    data: results,
                });
            }
            catch (error) {
                return ProjectController.handleError(error, res, "Failed to perform bulk delete");
            }
        });
    }
    // Health check endpoint
    static healthCheck(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Simple count query to verify database connectivity
                const result = yield project_service_1.ProjectService.getAllProjects({ page: 1, limit: 1 });
                return res.status(200).json({
                    status: "success",
                    message: "Project service is healthy",
                    data: {
                        timestamp: new Date().toISOString(),
                        totalProjects: result.pagination.totalRecords,
                    },
                });
            }
            catch (error) {
                return res.status(503).json({
                    status: "error",
                    message: "Project service is unhealthy",
                    data: {
                        timestamp: new Date().toISOString(),
                        error: error.message,
                    },
                });
            }
        });
    }
}
exports.ProjectController = ProjectController;
