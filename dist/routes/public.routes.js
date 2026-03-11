"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const status_controller_1 = require("../controllers/status.controller");
const changelog_controller_1 = require("../controllers/changelog.controller");
const router = (0, express_1.Router)();
// --- Public Routes (No Authentication Required) ---
// System status
router.get("/status", status_controller_1.StatusController.getSystemStatus);
// Changelog
router.get("/changelog", changelog_controller_1.ChangelogController.getChangelogs);
exports.default = router;
