import { Router } from "express";
import { IntegrationsController } from "../controllers/integrations.controller";
import { verifyToken } from "../middleware/auth.middleware";

const router = Router();

// All routes require authentication
router.use(verifyToken);

// List all available integration types
router.get("/available", IntegrationsController.getAvailableIntegrations);

// List connected integrations for the user
router.get("/connected", IntegrationsController.getConnectedIntegrations);

// Get integration type metadata by slug (must come before /:id)
router.get("/type/:type", IntegrationsController.getIntegrationType);

// Connect a new integration
router.post("/:type/connect", IntegrationsController.connectIntegration);

// Get a single integration by ID
router.get("/:id", IntegrationsController.getIntegrationById);

// Test an existing integration
router.post("/:id/test", IntegrationsController.testIntegrationById);

// Disconnect (delete) an integration
router.delete("/:id", IntegrationsController.disconnectIntegration);

// Execute an action on a connected integration
router.post("/:id/action", IntegrationsController.executeAction);

export default router;
