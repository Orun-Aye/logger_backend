"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const log_controller_1 = require("../controllers/log.controller");
const router = (0, express_1.Router)();
router.post('/:projectId/logs', log_controller_1.LogController.createLog);
router.get('/:projectId/logs', log_controller_1.LogController.getAllLogs);
router.get('/:projectId/logs/:logId', log_controller_1.LogController.getLogById);
exports.default = router;
