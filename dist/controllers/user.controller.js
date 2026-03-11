"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = void 0;
const user_service_1 = require("../services/user.service");
const user_validator_1 = require("../validators/user.validator");
class UserController {
    // Centralized error handler
    static handleError(error, res, defaultMessage) {
        console.error(`UserController Error: ${error.message}`, error.stack);
        if (error instanceof user_service_1.UserValidationError) {
            return res.status(400).json({
                status: "error",
                message: error.message,
                errors: [error.message],
            });
        }
        return res.status(500).json({
            status: "error",
            message: defaultMessage,
            errors: [error.message],
        });
    }
    static async createUser(req, res) {
        try {
            const userData = req.body;
            if (!userData) {
                return res.status(400).json({
                    status: "error",
                    message: "Missing credentials",
                    data: null,
                });
            }
            const newUser = await user_service_1.UserService.createUser(userData);
            return res.status(201).json({
                status: "success",
                message: "User created successfully",
                data: newUser,
            });
        }
        catch (error) {
            return UserController.handleError(error, res, "Failed to create user");
        }
    }
    static async loginUser(req, res) {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                return res.status(400).json({
                    status: "error",
                    message: "Email and password are required",
                });
            }
            const user = await user_service_1.UserService.loginUser({ email, password });
            return res.status(200).json({
                status: "success",
                message: "User logged in successfully",
                data: user,
            });
        }
        catch (error) {
            return UserController.handleError(error, res, "Failed to login user");
        }
    }
    static async forgotPassword(req, res) {
        try {
            const parsed = user_validator_1.forgotPasswordSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({
                    status: "error",
                    message: "Validation failed",
                    errors: parsed.error.errors.map((e) => e.message),
                });
            }
            const result = await user_service_1.UserService.forgotPassword(parsed.data.email);
            return res.status(200).json({
                status: "success",
                message: result.message,
            });
        }
        catch (error) {
            return UserController.handleError(error, res, "Failed to process password reset request");
        }
    }
    static async resetPassword(req, res) {
        try {
            const parsed = user_validator_1.resetPasswordSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({
                    status: "error",
                    message: "Validation failed",
                    errors: parsed.error.errors.map((e) => e.message),
                });
            }
            const result = await user_service_1.UserService.resetPassword(parsed.data.token, parsed.data.newPassword);
            return res.status(200).json({
                status: "success",
                message: result.message,
            });
        }
        catch (error) {
            return UserController.handleError(error, res, "Failed to reset password");
        }
    }
    static async getProfile(req, res) {
        try {
            const data = await user_service_1.UserService.getProfile(req.userId);
            return res.status(200).json({ status: "success", data });
        }
        catch (error) {
            if (error.name === "UserNotFoundError") {
                return res.status(404).json({ status: "error", message: error.message });
            }
            return res.status(500).json({ status: "error", message: error.message });
        }
    }
    static async updateProfile(req, res) {
        try {
            const data = await user_service_1.UserService.updateProfile(req.userId, req.body);
            return res.status(200).json({ status: "success", message: "Profile updated", data });
        }
        catch (error) {
            if (error.name === "UserNotFoundError") {
                return res.status(404).json({ status: "error", message: error.message });
            }
            return res.status(500).json({ status: "error", message: error.message });
        }
    }
    static async changePassword(req, res) {
        try {
            const { currentPassword, newPassword } = req.body;
            const data = await user_service_1.UserService.changePassword(req.userId, currentPassword, newPassword);
            return res.status(200).json({ status: "success", ...data });
        }
        catch (error) {
            if (error.name === "UserValidationError") {
                return res.status(400).json({ status: "error", message: error.message });
            }
            if (error.name === "UserNotFoundError") {
                return res.status(404).json({ status: "error", message: error.message });
            }
            return res.status(500).json({ status: "error", message: error.message });
        }
    }
    static async oauthLogin(req, res) {
        try {
            const { code, provider } = req.body;
            const { OAuthService } = require("../services/oauth.service");
            const result = await OAuthService.login(code, provider);
            return res.status(200).json({ status: "success", data: result });
        }
        catch (error) {
            if (error.name === "UserValidationError") {
                return res.status(400).json({ status: "error", message: error.message });
            }
            return res.status(500).json({ status: "error", message: error.message });
        }
    }
}
exports.UserController = UserController;
