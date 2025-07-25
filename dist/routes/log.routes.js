"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const log_controller_1 = require("../controllers/log.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Accepts a log event tied to a project via API key
router.post('/logs', auth_middleware_1.authenticateApiKey, log_controller_1.LogController.ingestLogs);
exports.default = router;
