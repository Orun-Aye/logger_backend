"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const alertRule_controller_1 = require("../controllers/alertRule.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.verifyToken);
// CRUD operations
router.post("/", alertRule_controller_1.AlertRuleController.create);
router.get("/project/:projectId", alertRule_controller_1.AlertRuleController.getRuleByProject);
router.get("/:id", alertRule_controller_1.AlertRuleController.getRuleById);
router.put("/:id", alertRule_controller_1.AlertRuleController.update);
router.delete("/:id", alertRule_controller_1.AlertRuleController.delete);
// Phase 2.2 enhancements
router.post("/:id/test", alertRule_controller_1.AlertRuleController.testRule); // Test rule against recent logs
router.post("/:id/snooze", alertRule_controller_1.AlertRuleController.snoozeRule); // Snooze rule temporarily
router.get("/analytics/:projectId", alertRule_controller_1.AlertRuleController.getAnalytics); // Alert analytics
router.get("/timeline/:projectId", alertRule_controller_1.AlertRuleController.getTimeline); // Alert timeline
exports.default = router;
