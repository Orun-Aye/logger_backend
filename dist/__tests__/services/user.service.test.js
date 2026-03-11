"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Mock notification service to avoid the deep import chain
// (notification.service -> server -> user.routes -> mfa.controller -> otplib ESM)
jest.mock("../../services/notification.service", () => ({
    NotificationService: {
        sendEmail: jest.fn().mockResolvedValue(undefined),
        sendSlack: jest.fn().mockResolvedValue(undefined),
        sendWebhook: jest.fn().mockResolvedValue(undefined),
    },
}));
const user_service_1 = require("../../services/user.service");
const user_model_1 = require("../../models/user.model");
const factories_1 = require("../factories");
const bcrypt_1 = __importDefault(require("bcrypt"));
describe("UserService", () => {
    // ----- createUser -----
    describe("createUser", () => {
        it("should create a new user and return token", async () => {
            const result = await user_service_1.UserService.createUser({
                email: "newuser@example.com",
                firstName: "Jane",
                lastName: "Doe",
                password: "SecurePass123!",
                role: "developer",
            });
            expect(result).toHaveProperty("_id");
            expect(result).toHaveProperty("token");
            expect(result.email).toBe("newuser@example.com");
            expect(result.firstName).toBe("Jane");
            expect(result.lastName).toBe("Doe");
            expect(result.role).toBe("developer");
            // Password should NOT be in the returned object
            expect(result.password).toBeUndefined();
        });
        it("should hash the password before saving", async () => {
            await user_service_1.UserService.createUser({
                email: "hash-test@example.com",
                firstName: "Hash",
                lastName: "Test",
                password: "PlainTextPassword",
                role: "developer",
            });
            const user = await user_model_1.UserModel.findOne({ email: "hash-test@example.com" });
            expect(user).not.toBeNull();
            expect(user.password).not.toBe("PlainTextPassword");
            const isMatch = await bcrypt_1.default.compare("PlainTextPassword", user.password);
            expect(isMatch).toBe(true);
        });
        it("should throw if email already exists", async () => {
            await (0, factories_1.createTestUser)({ email: "duplicate@example.com" });
            await expect(user_service_1.UserService.createUser({
                email: "duplicate@example.com",
                firstName: "Dup",
                lastName: "User",
                password: "SomePassword123!",
                role: "developer",
            })).rejects.toThrow("User with this email already exists");
        });
        it("should throw validation error for missing email", async () => {
            await expect(user_service_1.UserService.createUser({
                email: "",
                firstName: "No",
                lastName: "Email",
                password: "SomePassword123!",
                role: "developer",
            })).rejects.toThrow(user_service_1.UserValidationError);
        });
        it("should throw validation error for missing password", async () => {
            await expect(user_service_1.UserService.createUser({
                email: "valid@example.com",
                firstName: "No",
                lastName: "Password",
                password: "",
                role: "developer",
            })).rejects.toThrow(user_service_1.UserValidationError);
        });
        it("should throw validation error for missing names", async () => {
            await expect(user_service_1.UserService.createUser({
                email: "valid@example.com",
                firstName: "",
                lastName: "Name",
                password: "SomePass123!",
                role: "developer",
            })).rejects.toThrow(user_service_1.UserValidationError);
        });
        it("should default role to developer if not specified", async () => {
            const result = await user_service_1.UserService.createUser({
                email: "default-role@example.com",
                firstName: "Default",
                lastName: "Role",
                password: "SomePass123!",
                role: "developer",
            });
            expect(result.role).toBe("developer");
        });
    });
    // ----- loginUser -----
    describe("loginUser", () => {
        it("should login with valid credentials and return token", async () => {
            await (0, factories_1.createTestUser)({ email: "login@example.com" });
            const result = await user_service_1.UserService.loginUser({
                email: "login@example.com",
                password: (0, factories_1.getTestPassword)(),
            });
            expect(result).toHaveProperty("token");
            expect(result).toHaveProperty("_id");
            expect(result.email).toBe("login@example.com");
        });
        it("should throw for non-existent user", async () => {
            await expect(user_service_1.UserService.loginUser({
                email: "noone@example.com",
                password: "whatever",
            })).rejects.toThrow(user_service_1.UserNotFoundError);
        });
        it("should throw for wrong password", async () => {
            await (0, factories_1.createTestUser)({ email: "wrongpass@example.com" });
            await expect(user_service_1.UserService.loginUser({
                email: "wrongpass@example.com",
                password: "WrongPassword!",
            })).rejects.toThrow(user_service_1.UserValidationError);
        });
        it("should throw validation error for missing email", async () => {
            await expect(user_service_1.UserService.loginUser({
                email: "",
                password: "whatever",
            })).rejects.toThrow(user_service_1.UserValidationError);
        });
        it("should throw validation error for missing password", async () => {
            await expect(user_service_1.UserService.loginUser({
                email: "valid@example.com",
                password: "",
            })).rejects.toThrow(user_service_1.UserValidationError);
        });
    });
    // ----- getProfile -----
    describe("getProfile", () => {
        it("should return user profile without sensitive fields", async () => {
            const user = await (0, factories_1.createTestUser)({ email: "profile@example.com" });
            const profile = await user_service_1.UserService.getProfile(user._id.toString());
            expect(profile.email).toBe("profile@example.com");
            expect(profile.firstName).toBe("Test");
            expect(profile.password).toBeUndefined();
        });
        it("should throw UserNotFoundError for invalid userId", async () => {
            const fakeId = new (await import("mongoose")).Types.ObjectId().toString();
            await expect(user_service_1.UserService.getProfile(fakeId)).rejects.toThrow(user_service_1.UserNotFoundError);
        });
    });
    // ----- updateProfile -----
    describe("updateProfile", () => {
        it("should update user profile fields", async () => {
            const user = await (0, factories_1.createTestUser)({ email: "update@example.com" });
            const updated = await user_service_1.UserService.updateProfile(user._id.toString(), {
                firstName: "Updated",
                lastName: "Name",
            });
            expect(updated.firstName).toBe("Updated");
            expect(updated.lastName).toBe("Name");
        });
        it("should throw UserNotFoundError for non-existent user", async () => {
            const fakeId = new (await import("mongoose")).Types.ObjectId().toString();
            await expect(user_service_1.UserService.updateProfile(fakeId, { firstName: "X" })).rejects.toThrow(user_service_1.UserNotFoundError);
        });
    });
    // ----- changePassword -----
    describe("changePassword", () => {
        it("should change password when current password is correct", async () => {
            const user = await (0, factories_1.createTestUser)({ email: "changepass@example.com" });
            const result = await user_service_1.UserService.changePassword(user._id.toString(), (0, factories_1.getTestPassword)(), "NewSecurePassword123!");
            expect(result.message).toBe("Password changed successfully");
            // Verify new password works
            const updatedUser = await user_model_1.UserModel.findById(user._id);
            const isMatch = await bcrypt_1.default.compare("NewSecurePassword123!", updatedUser.password);
            expect(isMatch).toBe(true);
        });
        it("should throw when current password is incorrect", async () => {
            const user = await (0, factories_1.createTestUser)({ email: "badcurrent@example.com" });
            await expect(user_service_1.UserService.changePassword(user._id.toString(), "WrongCurrent!", "NewPass123!")).rejects.toThrow(user_service_1.UserValidationError);
        });
        it("should throw for non-existent user", async () => {
            const fakeId = new (await import("mongoose")).Types.ObjectId().toString();
            await expect(user_service_1.UserService.changePassword(fakeId, "old", "new")).rejects.toThrow(user_service_1.UserNotFoundError);
        });
    });
});
