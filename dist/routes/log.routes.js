"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const log_controller_1 = require("../controllers/log.controller");
const router = (0, express_1.Router)();
// Accepts a log event tied to a project via API key
router.post('/', log_controller_1.createLog);
exports.default = router;
