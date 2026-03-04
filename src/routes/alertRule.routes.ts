import { Router } from "express";
import { AlertRuleController } from "../controllers/alertRule.controller";
import { verifyToken } from "../middleware/auth.middleware";

const router = Router();

router.use(verifyToken);

// CRUD operations
router.post("/", AlertRuleController.create);
router.get("/project/:projectId", AlertRuleController.getRuleByProject);
router.get("/:id", AlertRuleController.getRuleById);
router.put("/:id", AlertRuleController.update);
router.delete("/:id", AlertRuleController.delete);

// Phase 2.2 enhancements
router.post("/:id/test", AlertRuleController.testRule); // Test rule against recent logs
router.post("/:id/snooze", AlertRuleController.snoozeRule); // Snooze rule temporarily
router.get("/analytics/:projectId", AlertRuleController.getAnalytics); // Alert analytics
router.get("/timeline/:projectId", AlertRuleController.getTimeline); // Alert timeline

export default router;
