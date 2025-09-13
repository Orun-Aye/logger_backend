"use strict";
// src/controllers/log.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogController = void 0;
const log_service_1 = require("../services/log.service");
const log_dto_1 = require("../dtos/log.dto"); // Ensure CreateLogDTO is imported
class LogController {
    static handleError(error, res, defaultMessage) {
        console.error(`LogController Error: ${error.message}`, error.stack);
        if (error instanceof log_service_1.LogValidationError) { // Handle validation errors specifically
            return res.status(400).json({
                status: "error",
                message: error.message,
                errors: [error.message],
            });
        }
        if (error instanceof log_service_1.LogNotFoundError) {
            return res.status(404).json({
                status: "error",
                message: error.message,
            });
        }
        if (error instanceof log_service_1.LogServiceError) { // Catch other service-specific errors
            // LogServiceError can carry context, which might be useful for debugging
            const errors = error.context ? [`${error.message} (Context: ${JSON.stringify(error.context)})`] : [error.message];
            return res.status(500).json({
                status: "error",
                message: error.message,
                errors: errors,
            });
        }
        // Database/MongoDB specific errors
        if (error.name === "ValidationError") { // Mongoose validation error
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
    // Updated to accept projectId as a parameter, as most log operations are project-scoped
    static validatePaginationAndFilterParams(req, projectId) {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10)); // Cap at 100
        const allowedSortBy = [
            "timestamp",
            "level",
            "service",
            "environment",
            "createdAt",
            "updatedAt",
            "eventType", // New
            "url", // New
        ];
        let sortBy = "timestamp"; // Default to timestamp as it's most common for logs
        if (req.query.sortBy &&
            typeof req.query.sortBy === "string" &&
            allowedSortBy.includes(req.query.sortBy)) {
            sortBy = req.query.sortBy;
        }
        const sortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";
        const level = typeof req.query.level === "string" &&
            Object.values(log_dto_1.LogLevel).includes(req.query.level)
            ? req.query.level
            : undefined;
        const service = typeof req.query.service === "string" ? req.query.service : undefined;
        const environment = typeof req.query.environment === "string" ? req.query.environment : undefined;
        const search = typeof req.query.search === "string" ? req.query.search : undefined;
        const startDate = typeof req.query.startDate === "string"
            ? new Date(req.query.startDate)
            : undefined;
        const endDate = typeof req.query.endDate === "string"
            ? new Date(req.query.endDate)
            : undefined;
        // New fields from LogModel and FilterLogsDTO
        const eventType = typeof req.query.eventType === "string" ? req.query.eventType : undefined;
        const userAgent = typeof req.query.userAgent === "string" ? req.query.userAgent : undefined;
        const url = typeof req.query.url === "string" ? req.query.url : undefined;
        const referrer = typeof req.query.referrer === "string" ? req.query.referrer : undefined;
        const errorName = typeof req.query.errorName === "string" ? req.query.errorName : undefined;
        const errorMessage = typeof req.query.errorMessage === "string" ? req.query.errorMessage : undefined;
        return {
            projectId: projectId, // Pass projectId from the route parameter
            page,
            limit,
            sortBy,
            sortOrder,
            level,
            service,
            environment,
            search,
            startDate,
            endDate,
            eventType,
            userAgent,
            url,
            referrer,
            errorName,
            errorMessage,
        };
    }
    // --- Core Log Operations ---
    static async createLog(req, res) {
        try {
            // Assuming projectId comes from req.params as /projects/:projectId/logs
            const { projectId } = req.params;
            const logData = { ...req.body, projectId };
            // Basic validation for required fields in the body
            if (!logData.level || !logData.message) {
                return res.status(400).json({
                    status: "error",
                    message: "Log level and message are required.",
                });
            }
            const log = await log_service_1.LogService.createLog(logData);
            return res.status(201).json({
                status: "success",
                message: "Log entry created successfully",
                data: log,
            });
        }
        catch (error) {
            return LogController.handleError(error, res, "Failed to create log entry");
        }
    }
    static async getAllLogs(req, res) {
        try {
            const { projectId } = req.params; // Get projectId from route params
            const filters = LogController.validatePaginationAndFilterParams(req, projectId); // Pass projectId to helper
            const result = await log_service_1.LogService.getAllLogs(filters);
            return res.status(200).json({
                status: "success",
                message: "Logs fetched successfully",
                data: result.logs,
                meta: {
                    pagination: result.pagination,
                    filters: filters, // Include all applied filters in meta for clarity
                },
            });
        }
        catch (error) {
            return LogController.handleError(error, res, "Failed to fetch logs");
        }
    }
    static async getLogById(req, res) {
        try {
            const { logId } = req.params; // Assuming route is /logs/:logId or /projects/:projectId/logs/:logId
            const log = await log_service_1.LogService.getLogById(logId);
            return res.status(200).json({
                status: "success",
                message: "Log fetched successfully",
                data: log,
            });
        }
        catch (error) {
            return LogController.handleError(error, res, "Failed to fetch log");
        }
    }
    // --- Log Analytics and Summaries ---
    static async getLogsSummary(req, res) {
        try {
            const { projectId } = req.params;
            const { startDate, endDate, level, service, environment, eventType } = req.query;
            const options = {
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                level: level,
                service: service,
                environment: environment,
                eventType: eventType,
            };
            const summary = await log_service_1.LogService.getLogsSummary(projectId, options);
            return res.status(200).json({
                status: "success",
                message: "Log summary fetched successfully",
                data: summary,
                meta: summary.metadata,
            });
        }
        catch (error) {
            return LogController.handleError(error, res, "Failed to fetch log summary");
        }
    }
    static async getLogTrends(req, res) {
        try {
            const { projectId } = req.params;
            const { startDate, endDate, groupBy, level, service, environment, eventType } = req.query;
            const options = {
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                groupBy: groupBy,
                level: level,
                service: service,
                environment: environment,
                eventType: eventType,
            };
            const trends = await log_service_1.LogService.getLogTrends(projectId, options);
            return res.status(200).json({
                status: "success",
                message: "Log trends fetched successfully",
                data: trends.trends,
                meta: trends.metadata,
            });
        }
        catch (error) {
            return LogController.handleError(error, res, "Failed to fetch log trends");
        }
    }
    // --- Log Deletion ---
    static async deleteLogs(req, res) {
        try {
            const { projectId } = req.params; // projectId is required for deletion
            const filters = LogController.validatePaginationAndFilterParams(req, projectId); // Use existing helper for filters
            // IMPORTANT: Ensure filters are not empty beyond projectId to prevent accidental mass deletion.
            // The service layer already has a safeguard, but adding a controller-level check is good practice.
            const filterKeys = Object.keys(filters).filter(key => key !== 'projectId' && filters[key] !== undefined);
            if (filterKeys.length === 0) {
                return res.status(400).json({
                    status: "error",
                    message: "At least one specific filter (e.g., level, search, startDate, eventType) is required for log deletion to prevent accidental mass deletion.",
                });
            }
            const result = await log_service_1.LogService.deleteLogs(filters);
            return res.status(200).json({
                status: "success",
                message: `Successfully deleted ${result.deletedCount} log entries.`,
                data: { deletedCount: result.deletedCount },
            });
        }
        catch (error) {
            return LogController.handleError(error, res, "Failed to delete logs");
        }
    }
    // --- Utility Methods for UI Filters ---
    static async getDistinctValues(req, res) {
        try {
            const { projectId, field } = req.params; // field will be a path param like /distinct-values/:field
            const allowedFields = [
                "level", "service", "environment", "eventType", "url", "userAgent", "error.name"
            ];
            if (!field || !allowedFields.includes(field)) {
                return res.status(400).json({
                    status: "error",
                    message: `Invalid or missing field parameter. Allowed fields are: ${allowedFields.join(", ")}`,
                });
            }
            const distinctValues = await log_service_1.LogService.getDistinctValues(projectId, field);
            return res.status(200).json({
                status: "success",
                message: `Distinct values for '${field}' fetched successfully`,
                data: distinctValues,
            });
        }
        catch (error) {
            return LogController.handleError(error, res, `Failed to fetch distinct values for field '${req.params.field}'`);
        }
    }
    static async getUniqueErrorMessages(req, res) {
        try {
            const { projectId } = req.params;
            const { page, limit, search } = req.query;
            const options = {
                page: page ? parseInt(page) : undefined,
                limit: limit ? parseInt(limit) : undefined,
                search: search,
            };
            const result = await log_service_1.LogService.getUniqueErrorMessages(projectId, options);
            return res.status(200).json({
                status: "success",
                message: "Unique error messages fetched successfully",
                data: result.messages,
                meta: result.pagination,
            });
        }
        catch (error) {
            return LogController.handleError(error, res, "Failed to fetch unique error messages");
        }
    }
}
exports.LogController = LogController;
