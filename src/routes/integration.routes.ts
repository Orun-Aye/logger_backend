import { Router } from "express";
import { IntegrationController } from "../controllers/integration.controller";
import { verifyToken } from "../middleware/auth.middleware";

const router = Router();

router.use(verifyToken);

// Test an integration (Slack, Email, or Webhook)
router.post("/:projectId/test", IntegrationController.testIntegration);

export default router;
