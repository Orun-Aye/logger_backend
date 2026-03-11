"use strict";
// src/routes/trace.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const trace_controller_1 = require("../controllers/trace.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// All trace routes require JWT authentication
router.get("/:projectId/traces", auth_middleware_1.verifyToken, trace_controller_1.TraceController.getTraces);
router.get("/:projectId/traces/:traceId", auth_middleware_1.verifyToken, trace_controller_1.TraceController.getTraceDetail);
router.get("/:projectId/traces/:traceId/spans", auth_middleware_1.verifyToken, trace_controller_1.TraceController.getTraceSpans);
exports.default = router;
