"use strict";
// src/controllers/health.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthController = void 0;
const health_service_1 = require("../services/health.service");
/**
 * Health check controller
 * Provides endpoints for health, readiness, and liveness probes
 */
class HealthController {
    /**
     * Comprehensive health check with component status
     * GET /api/v1/health
     */
    static async health(req, res) {
        try {
            const healthStatus = await health_service_1.HealthService.getHealthStatus();
            const statusCode = healthStatus.status === "healthy" ? 200 : 503;
            return res.status(statusCode).json({
                status: healthStatus.status === "healthy" ? "success" : "error",
                data: healthStatus,
            });
        }
        catch (error) {
            return res.status(503).json({
                status: "error",
                message: "Health check failed",
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }
    /**
     * Readiness probe - checks if service can accept traffic
     * GET /api/v1/ready
     */
    static async ready(req, res) {
        try {
            const isReady = await health_service_1.HealthService.checkReadiness();
            if (isReady) {
                return res.status(200).json({
                    status: "success",
                    message: "Service is ready",
                });
            }
            else {
                return res.status(503).json({
                    status: "error",
                    message: "Service is not ready",
                });
            }
        }
        catch (error) {
            return res.status(503).json({
                status: "error",
                message: "Readiness check failed",
            });
        }
    }
    /**
     * Liveness probe - checks if service is alive
     * GET /api/v1/live
     */
    static live(req, res) {
        const isAlive = health_service_1.HealthService.checkLiveness();
        if (isAlive) {
            return res.status(200).json({
                status: "success",
                message: "Service is alive",
            });
        }
        else {
            return res.status(503).json({
                status: "error",
                message: "Service is not alive",
            });
        }
    }
}
exports.HealthController = HealthController;
