"use strict";
// src/routes/health.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const health_controller_1 = require("../controllers/health.controller");
const router = (0, express_1.Router)();
/**
 * Health check routes
 * These endpoints don't require authentication
 */
// Comprehensive health check with component status
router.get("/health", health_controller_1.HealthController.health);
// Kubernetes/container readiness probe
router.get("/ready", health_controller_1.HealthController.ready);
// Kubernetes/container liveness probe
router.get("/live", health_controller_1.HealthController.live);
exports.default = router;
