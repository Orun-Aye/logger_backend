import { CreateUserDTO, LoginUserDTO } from "../dtos/user.dto";
import { IUser, UserModel } from "../models/user.model";
import { WaitlistModel } from "../models/waitlist.model";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { NotificationService } from "./notification.service";

dotenv.config();
const secret = process.env.JWT_SECRET;

export class UserNotFoundError extends Error {
  constructor() {
    super("User not found");
    this.name = "UserNotFoundError";
  }
}

export class UserValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserValidationError";
  }
}

export class UserService {
  // Input validation and sanitization methods can be added here
  private static validateUserSignupData(data: Partial<IUser>) {
    if (!data.email || typeof data.email !== "string") {
      throw new UserValidationError("Invalid email format");
    }
    if (
      !data.firstName ||
      !data.lastName ||
      typeof data.firstName !== "string" ||
      typeof data.lastName !== "string"
    ) {
      throw new UserValidationError("Both first and last name are required");
    }
    if (data.role && !["developer", "admin"].includes(data.role)) {
      throw new UserValidationError("Invalid role specified");
    }
    if (!data.password || typeof data.password !== "string") {
      throw new UserValidationError("Password is required");
    }
  }

  private static validateUserLoginData(data: Partial<IUser>) {
    if (!data.email || typeof data.email !== "string") {
      throw new UserValidationError("Invalid email format");
    }
    if (!data.password || typeof data.password !== "string") {
      throw new UserValidationError("Password is required");
    }
  }

  static async createUser(data: CreateUserDTO) {
    try {
      this.validateUserSignupData(data);

      // Invite code is required during beta
      if (!data.inviteCode) {
        throw new UserValidationError(
          "An invite code is required to sign up during early access."
        );
      }

      // Validate invite code against waitlist
      const waitlistEntry = await WaitlistModel.findOne({
        inviteCode: data.inviteCode,
      });

      if (!waitlistEntry || waitlistEntry.status !== "approved") {
        throw new UserValidationError("Invalid or expired invite code.");
      }

      if (waitlistEntry.signedUpAt) {
        throw new UserValidationError(
          "This invite code has already been used."
        );
      }

      // Check for existing user with the same email
      const existingUser = await UserModel.findOne({
        email: data.email,
      });
      if (existingUser) {
        throw new UserValidationError("User with this email already exists");
      }

      // Hash the password here if needed
      const hashedPassword = await bcrypt.hash(data.password, 10);

      // Create a new user with beta access
      const newUser = new UserModel({
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        password: hashedPassword,
        role: data.role || "developer",
        betaAccess: true,
        betaTier: "full",
        inviteCode: data.inviteCode,
      });
      const savedUser = await newUser.save();

      // Mark waitlist entry as signed up
      waitlistEntry.signedUpAt = new Date();
      await waitlistEntry.save();

      if (!secret) {
        throw new Error("JWT secret is not defined in environment variables");
      }
      const token = jwt.sign(
        {
          userId: savedUser._id,
          role: savedUser.role,
          betaAccess: savedUser.betaAccess,
          betaTier: savedUser.betaTier,
        },
        secret,
        { expiresIn: "10h" }
      );

      return {
        _id: savedUser._id,
        email: savedUser.email,
        firstName: savedUser.firstName,
        lastName: savedUser.lastName,
        role: savedUser.role,
        betaAccess: savedUser.betaAccess,
        betaTier: savedUser.betaTier,
        token,
        joinedAt: savedUser.joinedAt,
      };
    } catch (error) {
      if (error instanceof UserValidationError) {
        throw error;
      }
      throw new Error(`Failed to create user: ${error}`);
    }
  }

  static async loginUser(data: LoginUserDTO) {
    try {
      this.validateUserLoginData(data);

      // Find user by email
      const user = await UserModel.findOne({
        email: data.email,
      });
      // Deliberately the same error as a bad password: a distinct "user not
      // found" here would both 500 (UserNotFoundError is not mapped to a 4xx)
      // and hand out an account-enumeration oracle on an unauthenticated route.
      if (!user) {
        throw new UserValidationError("Invalid email or password");
      }
      const isPasswordValid = await bcrypt.compare(
        data.password,
        user.password
      );
      if (!isPasswordValid) {
        throw new UserValidationError("Invalid email or password");
      }

      if (!secret) {
        throw new Error("JWT secret is not defined in environment variables");
      }

      // If MFA is enabled, return a short-lived MFA token instead of full JWT
      if (user.mfaEnabled) {
        const mfaToken = jwt.sign(
          { userId: user._id, mfaRequired: true },
          secret,
          { expiresIn: "5m" }
        );
        return {
          requiresMfa: true,
          mfaToken,
        };
      }

      const token = jwt.sign(
        {
          userId: user._id,
          role: user.role,
          betaAccess: user.betaAccess,
          betaTier: user.betaTier,
        },
        secret,
        { expiresIn: "10h" }
      );

      return {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        betaAccess: user.betaAccess,
        betaTier: user.betaTier,
        token,
        joinedAt: user.joinedAt,
      };
    } catch (error) {
      if (error instanceof UserValidationError || error instanceof UserNotFoundError) {
        throw error;
      }
      throw new Error(`Failed to login user: ${error}`);
    }
  }

  static async forgotPassword(email: string) {
    try {
      const user = await UserModel.findOne({ email: email.toLowerCase().trim() });

      // Always return success to prevent email enumeration
      if (!user) {
        return { message: "If an account with that email exists, a reset link has been sent." };
      }

      // Generate raw token and hash for storage
      const rawToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

      user.resetPasswordToken = hashedToken;
      user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await user.save();

      // Build reset URL pointing to frontend
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const resetUrl = `${frontendUrl}/reset-password/${rawToken}`;

      await NotificationService.sendEmail({
        to: [user.email],
        subject: "Apperio — Reset Your Password",
        html: `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #060b14; border-radius: 12px; overflow: hidden;">
            <div style="padding: 32px 32px 24px; text-align: center;">
              <h1 style="color: #00d97e; font-size: 28px; margin: 0 0 4px;">Apperio</h1>
              <p style="color: #8b95a5; font-size: 13px; margin: 0;">Observability Platform</p>
            </div>
            <div style="padding: 0 32px 32px;">
              <h2 style="color: #e2e8f0; font-size: 20px; margin: 0 0 12px;">Password Reset Request</h2>
              <p style="color: #8b95a5; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                Hi ${user.firstName}, we received a request to reset your password. Click the button below to choose a new one. This link expires in <strong style="color: #e2e8f0;">1 hour</strong>.
              </p>
              <div style="text-align: center; margin: 0 0 24px;">
                <a href="${resetUrl}" style="display: inline-block; background: #00d97e; color: #060b14; font-weight: 600; font-size: 14px; padding: 12px 32px; border-radius: 8px; text-decoration: none;">
                  Reset Password
                </a>
              </div>
              <p style="color: #8b95a5; font-size: 12px; line-height: 1.5; margin: 0;">
                If you didn&rsquo;t request this, you can safely ignore this email. Your password won&rsquo;t change.
              </p>
            </div>
            <div style="padding: 16px 32px; border-top: 1px solid #1e293b;">
              <p style="color: #475569; font-size: 11px; margin: 0; text-align: center;">
                &copy; ${new Date().getFullYear()} Apperio. All rights reserved.
              </p>
            </div>
          </div>
        `,
        text: `Hi ${user.firstName},\n\nWe received a request to reset your Apperio password.\n\nReset your password: ${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.\n\n— Apperio`,
      });

      return { message: "If an account with that email exists, a reset link has been sent." };
    } catch (error) {
      throw new Error(`Failed to process password reset request: ${error}`);
    }
  }

  static async resetPassword(token: string, newPassword: string) {
    try {
      const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

      const user = await UserModel.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: new Date() },
      });

      if (!user) {
        throw new UserValidationError("Invalid or expired reset token");
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      return { message: "Password has been reset successfully" };
    } catch (error) {
      if (error instanceof UserValidationError) {
        throw error;
      }
      throw new Error(`Failed to reset password: ${error}`);
    }
  }

  static async getProfile(userId: string) {
    try {
      const user = await UserModel.findById(userId).select(
        "-password -resetPasswordToken -resetPasswordExpires -accessToken -refreshToken"
      );
      if (!user) {
        throw new UserNotFoundError();
      }
      return user;
    } catch (error) {
      if (error instanceof UserNotFoundError) throw error;
      throw new Error(`Failed to get profile: ${error}`);
    }
  }

  static async updateProfile(userId: string, data: { firstName?: string; lastName?: string; avatarUrl?: string }) {
    try {
      const user = await UserModel.findByIdAndUpdate(
        userId,
        { $set: data },
        { new: true, runValidators: true }
      ).select("-password -resetPasswordToken -resetPasswordExpires -accessToken -refreshToken");
      if (!user) {
        throw new UserNotFoundError();
      }
      return user;
    } catch (error) {
      if (error instanceof UserNotFoundError) throw error;
      throw new Error(`Failed to update profile: ${error}`);
    }
  }

  static async changePassword(userId: string, currentPassword: string, newPassword: string) {
    try {
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new UserNotFoundError();
      }
      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        throw new UserValidationError("Current password is incorrect");
      }
      user.password = await bcrypt.hash(newPassword, 10);
      await user.save();
      return { message: "Password changed successfully" };
    } catch (error) {
      if (error instanceof UserNotFoundError || error instanceof UserValidationError) throw error;
      throw new Error(`Failed to change password: ${error}`);
    }
  }
}
