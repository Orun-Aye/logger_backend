import { Router } from "express";
import { AlertRuleController } from "../controllers/alertRule.controller";
import { authenticateApiKey } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticateApiKey);

router.post("/", AlertRuleController.create);
router.get("/", AlertRuleController.getRuleByProject);
router.get("/:id", AlertRuleController.getRuleById);
router.put("/:id", AlertRuleController.update);
router.delete("/:id", AlertRuleController.delete);

export default router;
