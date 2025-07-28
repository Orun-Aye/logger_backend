"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
                errors: [error.message]
            });
        }
        return res.status(500).json({
            status: "error",
            message: defaultMessage,
            errors: [error.message]
        });
    }
    static createUser(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userData = req.body;
                const newUser = yield user_service_1.UserService.createUser(userData);
                return res.status(201).json({
                    status: "success",
                    message: "User created successfully",
                    data: newUser
                });
            }
            catch (error) {
                return UserController.handleError(error, res, "Failed to create user");
            }
        });
    }
    static loginUser(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { email, password } = req.body;
                if (!email || !password) {
                    return res.status(400).json({
                        status: "error",
                        message: "Email and password are required"
                    });
                }
                const user = yield user_service_1.UserService.loginUser({ email, password });
                return res.status(200).json({
                    status: "success",
                    message: "User logged in successfully",
                    data: user
                });
            }
            catch (error) {
                return UserController.handleError(error, res, "Failed to login user");
            }
        });
    }
}
exports.UserController = UserController;
