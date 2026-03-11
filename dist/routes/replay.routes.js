"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const replay_controller_1 = require("../controllers/replay.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Ingestion — API Key auth (from SDK)
router.post('/:projectId/replay', auth_middleware_1.authenticateApiKey, replay_controller_1.replayController.ingestReplay);
// Retrieval — JWT auth (from dashboard)
router.get('/:projectId/replay/sessions', auth_middleware_1.verifyToken, replay_controller_1.replayController.listSessions);
router.get('/:projectId/replay/:sessionId', auth_middleware_1.verifyToken, replay_controller_1.replayController.getSessionSegments);
router.delete('/:projectId/replay/sessions/:sessionId', auth_middleware_1.verifyToken, replay_controller_1.replayController.deleteSession);
exports.default = router;
