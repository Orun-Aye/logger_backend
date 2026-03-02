// src/routes/health.routes.ts

import { Router } from "express";
import { HealthController } from "../controllers/health.controller";

const router = Router();

/**
 * Health check routes
 * These endpoints don't require authentication
 */

// Comprehensive health check with component status
router.get("/health", HealthController.health);

// Kubernetes/container readiness probe
router.get("/ready", HealthController.ready);

// Kubernetes/container liveness probe
router.get("/live", HealthController.live);

export default router;
