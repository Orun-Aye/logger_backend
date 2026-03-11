"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_controller_1 = require("../controllers/user.controller");
const mfa_controller_1 = require("../controllers/mfa.controller");
const gdpr_controller_1 = require("../controllers/gdpr.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validation_middleware_1 = require("../middleware/validation.middleware");
const user_validator_1 = require("../validators/user.validator");
const router = (0, express_1.Router)();
// Public routes
router.post("/signup", user_controller_1.UserController.createUser);
router.post("/login", user_controller_1.UserController.loginUser);
router.post("/forgot-password", user_controller_1.UserController.forgotPassword);
router.post("/reset-password", user_controller_1.UserController.resetPassword);
router.post("/oauth/login", (0, validation_middleware_1.validate)(user_validator_1.oauthLoginSchema, "body"), user_controller_1.UserController.oauthLogin);
// MFA public route (uses mfaToken, not JWT)
router.post("/mfa/validate", mfa_controller_1.MfaController.validateMfa);
// Protected routes (require JWT)
router.get("/profile", auth_middleware_1.verifyToken, user_controller_1.UserController.getProfile);
router.put("/profile", auth_middleware_1.verifyToken, (0, validation_middleware_1.validate)(user_validator_1.updateProfileSchema, "body"), user_controller_1.UserController.updateProfile);
router.put("/change-password", auth_middleware_1.verifyToken, (0, validation_middleware_1.validate)(user_validator_1.changePasswordSchema, "body"), user_controller_1.UserController.changePassword);
// MFA protected routes (require JWT)
router.post("/mfa/setup", auth_middleware_1.verifyToken, mfa_controller_1.MfaController.setupMfa);
router.post("/mfa/verify", auth_middleware_1.verifyToken, mfa_controller_1.MfaController.verifyMfa);
router.post("/mfa/disable", auth_middleware_1.verifyToken, mfa_controller_1.MfaController.disableMfa);
router.get("/mfa/status", auth_middleware_1.verifyToken, mfa_controller_1.MfaController.getMfaStatus);
// GDPR data export and deletion (require JWT)
router.post("/data-export", auth_middleware_1.verifyToken, gdpr_controller_1.GdprController.exportData);
router.post("/data-deletion", auth_middleware_1.verifyToken, gdpr_controller_1.GdprController.deleteAccount);
exports.default = router;
