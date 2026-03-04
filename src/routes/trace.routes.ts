// src/routes/trace.routes.ts

import { Router } from "express";
import { TraceController } from "../controllers/trace.controller";
import { verifyToken } from "../middleware/auth.middleware";

const router = Router();

// All trace routes require JWT authentication
router.get("/:projectId/traces", verifyToken, TraceController.getTraces);
router.get("/:projectId/traces/:traceId", verifyToken, TraceController.getTraceDetail);
router.get("/:projectId/traces/:traceId/spans", verifyToken, TraceController.getTraceSpans);

export default router;
