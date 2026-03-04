// src/routes/webVitals.routes.ts

import { Router } from "express";
import { WebVitalsController } from "../controllers/webVitals.controller";
import { verifyToken } from "../middleware/auth.middleware";

const router = Router();

// All web vitals routes require JWT authentication
router.get("/:projectId/web-vitals", verifyToken, WebVitalsController.getWebVitals);
router.get("/:projectId/web-vitals/history", verifyToken, WebVitalsController.getWebVitalsHistory);
router.get("/:projectId/web-vitals/pages", verifyToken, WebVitalsController.getWebVitalsByPage);

export default router;
