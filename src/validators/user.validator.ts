// src/validators/user.validator.ts

import { z } from "zod";

/**
 * Password validation requirements
 */
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(100, "Password is too long")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

/**
 * Email validation schema
 */
const emailSchema = z
  .string()
  .email("Invalid email format")
  .toLowerCase()
  .trim();

/**
 * Schema for user signup
 */
export const signupSchema = z.object({
  email: emailSchema,
  firstName: z
    .string()
    .min(1, "First name is required")
    .max(50, "First name is too long")
    .trim(),
  lastName: z
    .string()
    .min(1, "Last name is required")
    .max(50, "Last name is too long")
    .trim(),
  password: passwordSchema,
  role: z.enum(["developer", "admin"]).optional().default("developer"),
  oauthProvider: z.string().max(50).optional(),
  oauthId: z.string().max(200).optional(),
  avatarUrl: z.string().url().optional(),
});

/**
 * Schema for user login
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

/**
 * Schema for password reset request
 */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

/**
 * Schema for password reset
 */
export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: passwordSchema,
});

/**
 * Schema for updating user profile
 */
export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(50).trim().optional(),
  lastName: z.string().min(1).max(50).trim().optional(),
  avatarUrl: z.string().url().optional(),
});

/**
 * Schema for changing password
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
});

/**
 * Schema for OAuth login
 */
export const oauthLoginSchema = z.object({
  code: z.string().min(1, "OAuth code is required"),
  provider: z.enum(["github", "google"]),
});

// Type exports
export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type OAuthLoginInput = z.infer<typeof oauthLoginSchema>;
