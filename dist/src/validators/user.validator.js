"use strict";
// src/validators/user.validator.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.oauthLoginSchema = exports.changePasswordSchema = exports.updateProfileSchema = exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.loginSchema = exports.signupSchema = void 0;
const zod_1 = require("zod");
/**
 * Password validation requirements
 */
const passwordSchema = zod_1.z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password is too long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number");
/**
 * Email validation schema
 */
const emailSchema = zod_1.z
    .string()
    .email("Invalid email format")
    .toLowerCase()
    .trim();
/**
 * Schema for user signup
 */
exports.signupSchema = zod_1.z.object({
    email: emailSchema,
    firstName: zod_1.z
        .string()
        .min(1, "First name is required")
        .max(50, "First name is too long")
        .trim(),
    lastName: zod_1.z
        .string()
        .min(1, "Last name is required")
        .max(50, "Last name is too long")
        .trim(),
    password: passwordSchema,
    role: zod_1.z.enum(["developer", "admin"]).optional().default("developer"),
    oauthProvider: zod_1.z.string().max(50).optional(),
    oauthId: zod_1.z.string().max(200).optional(),
    avatarUrl: zod_1.z.string().url().optional(),
});
/**
 * Schema for user login
 */
exports.loginSchema = zod_1.z.object({
    email: emailSchema,
    password: zod_1.z.string().min(1, "Password is required"),
});
/**
 * Schema for password reset request
 */
exports.forgotPasswordSchema = zod_1.z.object({
    email: emailSchema,
});
/**
 * Schema for password reset
 */
exports.resetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, "Reset token is required"),
    newPassword: passwordSchema,
});
/**
 * Schema for updating user profile
 */
exports.updateProfileSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1).max(50).trim().optional(),
    lastName: zod_1.z.string().min(1).max(50).trim().optional(),
    avatarUrl: zod_1.z.string().url().optional(),
});
/**
 * Schema for changing password
 */
exports.changePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1, "Current password is required"),
    newPassword: passwordSchema,
});
/**
 * Schema for OAuth login
 */
exports.oauthLoginSchema = zod_1.z.object({
    code: zod_1.z.string().min(1, "OAuth code is required"),
    provider: zod_1.z.enum(["github", "google"]),
});
