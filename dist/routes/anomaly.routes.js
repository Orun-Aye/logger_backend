"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const anomaly_controller_1 = require("../controllers/anomaly.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.verifyToken);
// GET /anomalies/:projectId — list anomalies
router.get("/:projectId", anomaly_controller_1.AnomalyController.getAnomalies);
// GET /anomalies/:projectId/stats — anomaly stats
router.get("/:projectId/stats", anomaly_controller_1.AnomalyController.getAnomalyStats);
// POST /anomalies/:projectId/scan — manual scan trigger
router.post("/:projectId/scan", anomaly_controller_1.AnomalyController.scanNow);
// PATCH /anomalies/:anomalyId/acknowledge — acknowledge
router.patch("/:anomalyId/acknowledge", anomaly_controller_1.AnomalyController.acknowledgeAnomaly);
// PATCH /anomalies/:anomalyId/resolve — resolve
router.patch("/:anomalyId/resolve", anomaly_controller_1.AnomalyController.resolveAnomaly);
exports.default = router;
