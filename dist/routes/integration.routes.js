"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const integration_controller_1 = require("../controllers/integration.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.verifyToken);
// Test an integration (Slack, Email, or Webhook)
router.post("/:projectId/test", integration_controller_1.IntegrationController.testIntegration);
exports.default = router;
