"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_controller_1 = require("../controllers/user.controller");
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
// Protected routes (require JWT)
router.get("/profile", auth_middleware_1.verifyToken, user_controller_1.UserController.getProfile);
router.put("/profile", auth_middleware_1.verifyToken, (0, validation_middleware_1.validate)(user_validator_1.updateProfileSchema, "body"), user_controller_1.UserController.updateProfile);
router.put("/change-password", auth_middleware_1.verifyToken, (0, validation_middleware_1.validate)(user_validator_1.changePasswordSchema, "body"), user_controller_1.UserController.changePassword);
exports.default = router;
