import { Router } from "express";
import { AnomalyController } from "../controllers/anomaly.controller";
import { verifyToken } from "../middleware/auth.middleware";

const router = Router();

router.use(verifyToken);

// GET /anomalies/:projectId — list anomalies
router.get("/:projectId", AnomalyController.getAnomalies);

// GET /anomalies/:projectId/stats — anomaly stats
router.get("/:projectId/stats", AnomalyController.getAnomalyStats);

// POST /anomalies/:projectId/scan — manual scan trigger
router.post("/:projectId/scan", AnomalyController.scanNow);

// PATCH /anomalies/:anomalyId/acknowledge — acknowledge
router.patch("/:anomalyId/acknowledge", AnomalyController.acknowledgeAnomaly);

// PATCH /anomalies/:anomalyId/resolve — resolve
router.patch("/:anomalyId/resolve", AnomalyController.resolveAnomaly);

export default router;
