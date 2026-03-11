"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sdk_config_controller_1 = require("../controllers/sdk-config.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.get('/:projectId/config', auth_middleware_1.verifyToken, sdk_config_controller_1.SDKConfigController.getConfig);
router.put('/:projectId/config', auth_middleware_1.verifyToken, sdk_config_controller_1.SDKConfigController.updateConfig);
exports.default = router;
