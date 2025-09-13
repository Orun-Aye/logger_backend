"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = void 0;
const user_service_1 = require("../services/user.service");
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
}
exports.UserController = UserController;
