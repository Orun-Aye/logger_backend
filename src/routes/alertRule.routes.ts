import { Router } from "express";
import { AlertRuleController } from "../controllers/alertRule.controller";
import { verifyToken } from "../middleware/auth.middleware";

const router = Router();

router.use(verifyToken);

router.post("/", AlertRuleController.create);
router.get("/project/:projectId", AlertRuleController.getRuleByProject);
router.get("/:id", AlertRuleController.getRuleById);
router.put("/:id", AlertRuleController.update);
router.delete("/:id", AlertRuleController.delete);

export default router;
