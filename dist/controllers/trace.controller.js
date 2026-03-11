"use strict";
// src/controllers/trace.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.TraceController = void 0;
const trace_service_1 = require("../services/trace.service");
const trace_validator_1 = require("../validators/trace.validator");
const zod_1 = require("zod");
/**
 * TraceController - Handles HTTP requests for distributed tracing endpoints.
 */
class TraceController {
    /**
     * Centralized error handler for consistent error responses.
     */
    static handleError(error, res, defaultMessage) {
        console.error(`TraceController Error: ${error.message}`, error.stack);
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
        if (error instanceof trace_service_1.TraceValidationError) {
            return res.status(400).json({
                status: "error",
                message: error.message,
                errors: [error.message],
            });
        }
        if (error instanceof trace_service_1.TraceServiceError) {
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
     * GET /:projectId/traces
     * Retrieves a paginated list of traces for a project.
     */
    static async getTraces(req, res) {
        try {
            const params = trace_validator_1.traceProjectIdParamSchema.parse(req.params);
            const query = trace_validator_1.traceListQuerySchema.parse(req.query);
            const result = await trace_service_1.TraceService.getTraces(params.projectId, {
                startDate: query.startDate,
                endDate: query.endDate,
                minDuration: query.minDuration,
                status: query.status,
                service: query.service,
                page: query.page,
                limit: query.limit,
                sortBy: query.sortBy,
                sortOrder: query.sortOrder,
            });
            return res.status(200).json({
                status: "success",
                data: result,
                meta: {
                    projectId: params.projectId,
                    page: result.page,
                    limit: result.limit,
                    total: result.total,
                },
            });
        }
        catch (error) {
            return TraceController.handleError(error, res, "Failed to retrieve traces");
        }
    }
    /**
     * GET /:projectId/traces/:traceId
     * Retrieves all log entries for a specific trace.
     */
    static async getTraceDetail(req, res) {
        try {
            const params = trace_validator_1.traceDetailParamSchema.parse(req.params);
            const logs = await trace_service_1.TraceService.getTraceDetail(params.projectId, params.traceId);
            return res.status(200).json({
                status: "success",
                data: logs,
                meta: {
                    projectId: params.projectId,
                    traceId: params.traceId,
                    logCount: logs.length,
                },
            });
        }
        catch (error) {
            return TraceController.handleError(error, res, "Failed to retrieve trace detail");
        }
    }
    /**
     * GET /:projectId/traces/:traceId/spans
     * Retrieves the span tree for a specific trace.
     */
    static async getTraceSpans(req, res) {
        try {
            const params = trace_validator_1.traceDetailParamSchema.parse(req.params);
            const spans = await trace_service_1.TraceService.getTraceSpans(params.projectId, params.traceId);
            return res.status(200).json({
                status: "success",
                data: spans,
                meta: {
                    projectId: params.projectId,
                    traceId: params.traceId,
                    spanCount: spans.length,
                },
            });
        }
        catch (error) {
            return TraceController.handleError(error, res, "Failed to retrieve trace spans");
        }
    }
}
exports.TraceController = TraceController;
