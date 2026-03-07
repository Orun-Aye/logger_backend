import { Router } from "express";
import { verifyToken } from "../middleware/auth.middleware";
import { requireAdmin } from "../middleware/adminAuth.middleware";
import { AdminController } from "../controllers/admin.controller";
import { ChangelogController } from "../controllers/changelog.controller";

const router = Router();

// All admin routes require authentication + admin role
router.use(verifyToken, requireAdmin);

// --- KPI & Stats ---
router.get("/stats", AdminController.getStats);

// --- User Management ---
router.get("/users", AdminController.listUsers);
router.put("/users/:userId", AdminController.updateUser);

// --- Organization Management ---
router.get("/organizations", AdminController.listOrganizations);

// --- System Health ---
router.get("/system", AdminController.getSystemHealth);

// --- Usage Trends ---
router.get("/usage-trends", AdminController.getUsageTrends);

// --- Changelog Management ---
router.post("/changelog", ChangelogController.createChangelog);

export default router;
