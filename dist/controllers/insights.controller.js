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
exports.DashboardInsightsController = void 0;
const insights_service_1 = require("../services/insights.service");
const log_dto_1 = require("../dtos/log.dto");
/**
 * Controller class for handling dashboard insights API endpoints.
 * All methods are static to be used directly as Express route handlers.
 */
class DashboardInsightsController {
    /**
     * Centralized error handling for controller methods.
     * Maps service errors or generic errors to appropriate HTTP responses.
     * @param error The error object.
     * @param res The Express response object.
     * @param defaultMessage A default message for generic errors.
     * @returns The Express response with an error status and message.
     */
    static handleError(error, res, defaultMessage) {
        console.error(`DashboardInsightsController Error: ${error.message}`, error.stack);
        if (error instanceof insights_service_1.ProjectNotFoundError) {
            return res.status(404).json({
                status: "error",
                message: error.message,
            });
        }
        if (error instanceof insights_service_1.DashboardInsightsServiceError) {
            return res.status(400).json({
                // Use 400 for service-level validation/business logic errors
                status: "error",
                message: error.message,
                errors: [error.message],
            });
        }
        // Handle Mongoose specific errors (e.g., CastError for invalid ObjectId)
        if (error.name === "CastError") {
            return res.status(400).json({
                status: "error",
                message: "Invalid ID format.",
            });
        }
        // Generic server error
        return res.status(500).json({
            status: "error",
            message: defaultMessage,
            errors: [error.message || "An unexpected error occurred."],
        });
    }
    /**
     * Validates and parses query parameters for fetching insights.
     * @param req The Express request object.
     * @returns A GetInsightsDTO object with validated parameters.
     */
    static validateInsightsQueryParams(req) {
        const { range, from, to, severity, timezone } = req.query;
        const validRanges = [
            "1d",
            "7d",
            "30d",
            "custom",
            "24h",
            "1h",
            "1w",
            "4w",
            "1m",
            "3m",
            "6m",
            "1y",
        ];
        const validSeverities = Object.values(log_dto_1.LogLevel);
        // Validate range
        let validatedRange = "7d"; // Default
        if (typeof range === "string" && validRanges.includes(range)) {
            validatedRange = range;
        }
        // Validate from/to for custom range
        let validatedFrom;
        let validatedTo;
        if (validatedRange === "custom") {
            if (typeof from === "string" && from)
                validatedFrom = from;
            if (typeof to === "string" && to)
                validatedTo = to;
        }
        // Validate severity
        let validatedSeverity = undefined;
        if (typeof severity === "string" &&
            validSeverities.includes(severity)) {
            validatedSeverity = severity;
        }
        // Validate timezone
        let validatedTimezone;
        if (typeof timezone === "string" && timezone) {
            // Basic check for valid timezone format (e.g., 'UTC', 'America/New_York')
            // A more robust validation might involve a library like 'luxon' or 'moment-timezone'
            validatedTimezone = timezone;
        }
        return {
            range: validatedRange,
            from: validatedFrom,
            to: validatedTo,
            severity: validatedSeverity,
            timezone: validatedTimezone,
        };
    }
    /**
     * Handles fetching dashboard insights for a specific project.
     * GET /api/insights/:projectId
     */
    static getProjectInsights(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = process.hrtime.bigint(); // Start timing controller execution
            try {
                const { projectId } = req.params;
                if (!projectId) {
                    return res.status(400).json({
                        status: "error",
                        message: "Project ID is required in the URL",
                    });
                }
                // Validate and parse insights query paramters
                const insightsOptions = DashboardInsightsController.validateInsightsQueryParams(req);
                // Call the service method
                const insights = yield insights_service_1.DashboardInsightsService.getProjectInsights(projectId, insightsOptions);
                const endTime = process.hrtime.bigint();
                const queryExecutionTime = Number(endTime - startTime) / 1000000; // Convert to ms
                // Add controller-level metadata
                const responseMeta = Object.assign(Object.assign({}, insights.meta), { controllerExecutionTime: queryExecutionTime });
                // Ensure timeRange.from/to are ISO strings in meta for consistent API response
                if (insights.timeRange) {
                    responseMeta.timeRange = {
                        from: insights.timeRange.from.toISOString(),
                        to: insights.timeRange.from.toISOString(),
                        range: insights.timeRange.range,
                    };
                }
                return res.status(200).json({
                    status: "success",
                    message: "Dashboard insights fetched successfully.",
                    data: insights,
                    meta: responseMeta,
                });
            }
            catch (error) {
                return DashboardInsightsController.handleError(error, res, "Failed to fetch dashboard insights");
            }
        });
    }
    /**
     * Handles invalidating the cache for a specific project.
     * POST /api/insights/:projectId/invalidate-cache
     */
    static invalidateProjectCache(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { projectId } = req.params;
                if (!projectId) {
                    return res.status(400).json({
                        status: "error",
                        message: "Project ID is required",
                    });
                }
                yield insights_service_1.DashboardInsightsService.invalidateProjectCache(projectId);
                return res.status(200).json({
                    status: "success",
                    message: `Cache for project ${projectId} invalidated successfully.`,
                });
            }
            catch (error) {
                return DashboardInsightsController.handleError(error, res, "Failed to invalidate project cache");
            }
        });
    }
}
exports.DashboardInsightsController = DashboardInsightsController;
