"use strict";
// src/controllers/webVitals.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebVitalsController = void 0;
const webVitals_service_1 = require("../services/webVitals.service");
const webVitals_validator_1 = require("../validators/webVitals.validator");
const zod_1 = require("zod");
/**
 * WebVitalsController - Handles HTTP requests for web vitals aggregation endpoints.
 */
class WebVitalsController {
    /**
     * Centralized error handler for consistent error responses.
     */
    static handleError(error, res, defaultMessage) {
        console.error(`WebVitalsController Error: ${error.message}`, error.stack);
        if (error instanceof zod_1.ZodError) {
            const formattedErrors = error.errors.map((err) => ({
                field: err.path.join("."),
                message: err.message,
                code: err.code,
            }));
            return res.status(400).json({
                status: "error",
                message: "Validation failed",
                errors: formattedErrors,
            });
        }
        if (error instanceof webVitals_service_1.WebVitalsValidationError) {
            return res.status(400).json({
                status: "error",
                message: error.message,
                errors: [error.message],
            });
        }
        if (error instanceof webVitals_service_1.WebVitalsServiceError) {
            return res.status(500).json({
                status: "error",
                message: error.message,
            });
        }
        return res.status(500).json({
            status: "error",
            message: defaultMessage,
        });
    }
    /**
     * GET /:projectId/web-vitals
     * Retrieves aggregated web vitals metrics (p50, p75, p95, rating counts).
     */
    static async getWebVitals(req, res) {
        try {
            const params = webVitals_validator_1.webVitalsProjectIdParamSchema.parse(req.params);
            const query = webVitals_validator_1.webVitalsQuerySchema.parse(req.query);
            const vitals = await webVitals_service_1.WebVitalsService.getWebVitals(params.projectId, query.timeRange, query.page);
            return res.status(200).json({
                status: "success",
                data: vitals,
                meta: {
                    projectId: params.projectId,
                    timeRange: query.timeRange,
                    page: query.page || null,
                    vitalCount: vitals.length,
                },
            });
        }
        catch (error) {
            return WebVitalsController.handleError(error, res, "Failed to retrieve web vitals");
        }
    }
    /**
     * GET /:projectId/web-vitals/history
     * Retrieves time-bucketed web vitals history for charting.
     */
    static async getWebVitalsHistory(req, res) {
        try {
            const params = webVitals_validator_1.webVitalsProjectIdParamSchema.parse(req.params);
            const query = webVitals_validator_1.webVitalsHistorySchema.parse(req.query);
            const history = await webVitals_service_1.WebVitalsService.getWebVitalsHistory(params.projectId, query.timeRange, query.interval);
            return res.status(200).json({
                status: "success",
                data: history,
                meta: {
                    projectId: params.projectId,
                    timeRange: query.timeRange,
                    interval: query.interval,
                    dataPoints: history.length,
                },
            });
        }
        catch (error) {
            return WebVitalsController.handleError(error, res, "Failed to retrieve web vitals history");
        }
    }
    /**
     * GET /:projectId/web-vitals/pages
     * Retrieves web vitals aggregated per page URL.
     */
    static async getWebVitalsByPage(req, res) {
        try {
            const params = webVitals_validator_1.webVitalsProjectIdParamSchema.parse(req.params);
            const query = webVitals_validator_1.webVitalsByPageSchema.parse(req.query);
            const pages = await webVitals_service_1.WebVitalsService.getWebVitalsByPage(params.projectId, query.timeRange);
            return res.status(200).json({
                status: "success",
                data: pages,
                meta: {
                    projectId: params.projectId,
                    timeRange: query.timeRange,
                    pageCount: pages.length,
                },
            });
        }
        catch (error) {
            return WebVitalsController.handleError(error, res, "Failed to retrieve web vitals by page");
        }
    }
}
exports.WebVitalsController = WebVitalsController;
