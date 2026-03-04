import { Router } from "express";
import { EscalationPolicyController } from "../controllers/escalationPolicy.controller";
import { verifyToken } from "../middleware/auth.middleware";

const router = Router();

router.use(verifyToken);

// CRUD operations
router.post("/", EscalationPolicyController.create);
router.get("/project/:projectId", EscalationPolicyController.getByProject);
router.get("/:id", EscalationPolicyController.getById);
router.put("/:id", EscalationPolicyController.update);
router.delete("/:id", EscalationPolicyController.delete);

export default router;
