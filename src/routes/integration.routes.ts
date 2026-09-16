import { Router } from "express";
import { IntegrationController } from "../controllers/integration.controller";
import { verifyToken } from "../middleware/auth.middleware";

const router = Router();

// Auth is per-route on purpose. A blanket `router.use(verifyToken)` here also
// runs for paths this router does not handle, and this router is mounted on
// /api/v1/integrations ahead of githubIntegrationRoutes — which would 401 the
// GitHub OAuth/App callbacks that authenticate via `state` or `?token=`
// instead of an Authorization header.
// Test an integration (Slack, Email, or Webhook)
router.post("/:projectId/test", verifyToken, IntegrationController.testIntegration);

export default router;
