"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const adminAuth_middleware_1 = require("../middleware/adminAuth.middleware");
const admin_controller_1 = require("../controllers/admin.controller");
const changelog_controller_1 = require("../controllers/changelog.controller");
const router = (0, express_1.Router)();
// All admin routes require authentication + admin role
router.use(auth_middleware_1.verifyToken, adminAuth_middleware_1.requireAdmin);
// --- KPI & Stats ---
router.get("/stats", admin_controller_1.AdminController.getStats);
// --- User Management ---
router.get("/users", admin_controller_1.AdminController.listUsers);
router.put("/users/:userId", admin_controller_1.AdminController.updateUser);
// --- Organization Management ---
router.get("/organizations", admin_controller_1.AdminController.listOrganizations);
// --- System Health ---
router.get("/system", admin_controller_1.AdminController.getSystemHealth);
// --- Usage Trends ---
router.get("/usage-trends", admin_controller_1.AdminController.getUsageTrends);
// --- Changelog Management ---
router.post("/changelog", changelog_controller_1.ChangelogController.createChangelog);
exports.default = router;
