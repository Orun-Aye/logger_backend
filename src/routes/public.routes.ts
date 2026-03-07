import { Router } from "express";
import { StatusController } from "../controllers/status.controller";
import { ChangelogController } from "../controllers/changelog.controller";

const router = Router();

// --- Public Routes (No Authentication Required) ---

// System status
router.get("/status", StatusController.getSystemStatus);

// Changelog
router.get("/changelog", ChangelogController.getChangelogs);

export default router;
