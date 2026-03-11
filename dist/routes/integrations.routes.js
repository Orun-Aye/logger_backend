"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const integrations_controller_1 = require("../controllers/integrations.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_middleware_1.verifyToken);
// List all available integration types
router.get("/available", integrations_controller_1.IntegrationsController.getAvailableIntegrations);
// List connected integrations for the user
router.get("/connected", integrations_controller_1.IntegrationsController.getConnectedIntegrations);
// Get integration type metadata by slug (must come before /:id)
router.get("/type/:type", integrations_controller_1.IntegrationsController.getIntegrationType);
// Connect a new integration
router.post("/:type/connect", integrations_controller_1.IntegrationsController.connectIntegration);
// Get a single integration by ID
router.get("/:id", integrations_controller_1.IntegrationsController.getIntegrationById);
// Test an existing integration
router.post("/:id/test", integrations_controller_1.IntegrationsController.testIntegrationById);
// Disconnect (delete) an integration
router.delete("/:id", integrations_controller_1.IntegrationsController.disconnectIntegration);
// Execute an action on a connected integration
router.post("/:id/action", integrations_controller_1.IntegrationsController.executeAction);
exports.default = router;
