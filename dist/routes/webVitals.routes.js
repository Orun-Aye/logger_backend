"use strict";
// src/routes/webVitals.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const webVitals_controller_1 = require("../controllers/webVitals.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// All web vitals routes require JWT authentication
router.get("/:projectId/web-vitals", auth_middleware_1.verifyToken, webVitals_controller_1.WebVitalsController.getWebVitals);
router.get("/:projectId/web-vitals/history", auth_middleware_1.verifyToken, webVitals_controller_1.WebVitalsController.getWebVitalsHistory);
router.get("/:projectId/web-vitals/pages", auth_middleware_1.verifyToken, webVitals_controller_1.WebVitalsController.getWebVitalsByPage);
exports.default = router;
