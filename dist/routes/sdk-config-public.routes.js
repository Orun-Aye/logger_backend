"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sdk_config_controller_1 = require("../controllers/sdk-config.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// SDK fetches its remote config via API key (no JWT needed)
// GET /api/v1/sdk-config — with X-API-Key header
router.get('/', auth_middleware_1.authenticateApiKey, sdk_config_controller_1.SDKConfigController.getConfigByApiKey);
exports.default = router;
