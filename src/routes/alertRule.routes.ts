import { Router } from "express";
import { AlertRuleController } from "../controllers/alertRule.controller";
import { authenticateApiKey } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticateApiKey);

router.get("/", AlertRuleController.list);
router.post("/", AlertRuleController.create);
router.put("/:id", AlertRuleController.update);
router.delete("/:id", AlertRuleController.delete);

export default router;
