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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = exports.UserValidationError = exports.UserNotFoundError = void 0;
const user_model_1 = require("../models/user.model");
const dotenv_1 = __importDefault(require("dotenv"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
dotenv_1.default.config();
const secret = process.env.JWT_SECRET;
class UserNotFoundError extends Error {
    constructor() {
        super("User not found");
        this.name = "UserNotFoundError";
    }
}
exports.UserNotFoundError = UserNotFoundError;
class UserValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "UserValidationError";
    }
}
exports.UserValidationError = UserValidationError;
class UserService {
    // Input validation and sanitization methods can be added here
    static validateUserSignupData(data) {
        if (!data.email || typeof data.email !== "string") {
            throw new UserValidationError("Invalid email format");
        }
        if (!data.firstName ||
            !data.lastName ||
            typeof data.firstName !== "string" ||
            typeof data.lastName !== "string") {
            throw new UserValidationError("Both first and last name are required");
        }
        if (data.role && !["developer", "admin"].includes(data.role)) {
            throw new UserValidationError("Invalid role specified");
        }
        if (!data.password || typeof data.password !== "string") {
            throw new UserValidationError("Password is required");
        }
    }
    static validateUserLoginData(data) {
        if (!data.email || typeof data.email !== "string") {
            throw new UserValidationError("Invalid email format");
        }
        if (!data.password || typeof data.password !== "string") {
            throw new UserValidationError("Password is required");
        }
    }
    static createUser(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.validateUserSignupData(data);
                const hashedPassword = yield bcrypt_1.default.hash(data.password, 10); // Hash the password here if needed
                // Check for existing user with the same email
                const existingUser = yield user_model_1.UserModel.findOne({
                    email: data.email,
                });
                if (existingUser) {
                    throw new UserValidationError("User with this email already exists");
                }
                // Create a new user
                const newUser = new user_model_1.UserModel({
                    email: data.email,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    password: hashedPassword, // Use the hashed password
                    role: data.role || "developer",
                });
                const savedUser = yield newUser.save();
                if (!secret) {
                    throw new Error("JWT secret is not defined in environment variables");
                }
                const token = jsonwebtoken_1.default.sign({ userId: savedUser._id }, secret, {
                    expiresIn: "10h",
                });
                return {
                    _id: savedUser._id,
                    email: savedUser.email,
                    firstName: savedUser.firstName,
                    lastName: savedUser.lastName,
                    role: savedUser.role,
                    token,
                    joinedAt: savedUser.joinedAt,
                };
            }
            catch (error) {
                if (error instanceof UserValidationError) {
                    throw error; // Re-throw validation errors
                }
                throw new Error(`Failed to create user: ${error}`);
            }
        });
    }
    static loginUser(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.validateUserLoginData(data);
                // Find user by email
                const user = yield user_model_1.UserModel.findOne({
                    email: data.email,
                });
                if (!user) {
                    throw new UserNotFoundError();
                }
                const isPasswordValid = yield bcrypt_1.default.compare(data.password, user.password);
                if (!isPasswordValid) {
                    throw new UserValidationError("Invalid email or password");
                }
                if (!secret) {
                    throw new Error("JWT secret is not defined in environment variables");
                }
                const token = jsonwebtoken_1.default.sign({ userId: user._id }, secret, {
                    expiresIn: "10h",
                });
                // Here you would typically check the password, but for simplicity, we assume password is not used
                return {
                    _id: user._id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role,
                    token,
                    joinedAt: user.joinedAt,
                };
            }
            catch (error) {
                if (error instanceof UserValidationError) {
                    throw error; // Re-throw validation errors
                }
                throw new Error(`Failed to login user: ${error}`);
            }
        });
    }
}
exports.UserService = UserService;
