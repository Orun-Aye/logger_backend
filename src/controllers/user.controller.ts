import { Request, Response } from "express";
import { UserService, UserValidationError } from "../services/user.service";
import { CreateUserDTO } from "../dtos/user.dto";
import { forgotPasswordSchema, resetPasswordSchema } from "../validators/user.validator";

interface ApiResponse<T = any> {
  status: "success" | "error";
  message?: string;
  data?: T;
  errors?: string[];
  meta?: any;
}

export class UserController {
  // Centralized error handler
  private static handleError(
    error: Error,
    res: Response,
    defaultMessage: string
  ): Response {
    console.error(`UserController Error: ${error.message}`, error.stack);

    if (error instanceof UserValidationError) {
      return res.status(400).json({
        status: "error",
        message: error.message,
        errors: [error.message],
      } as ApiResponse);
    }

    return res.status(500).json({
      status: "error",
      message: defaultMessage,
      errors: [error.message],
    } as ApiResponse);
  }

  static async createUser(req: Request, res: Response): Promise<Response> {
    try {
      const userData: CreateUserDTO = req.body;
      if (!userData) {
        return res.status(400).json({
          status: "error",
          message: "Missing credentials",
          data: null,
        });
      }
      const newUser = await UserService.createUser(userData);

      return res.status(201).json({
        status: "success",
        message: "User created successfully",
        data: newUser,
      } as ApiResponse);
    } catch (error) {
      return UserController.handleError(
        error as Error,
        res,
        "Failed to create user"
      );
    }
  }

  static async loginUser(req: Request, res: Response): Promise<Response> {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({
          status: "error",
          message: "Email and password are required",
        } as ApiResponse);
      }

      const user = await UserService.loginUser({ email, password });

      return res.status(200).json({
        status: "success",
        message: "User logged in successfully",
        data: user,
      } as ApiResponse);
    } catch (error) {
      return UserController.handleError(
        error as Error,
        res,
        "Failed to login user"
      );
    }
  }

  static async forgotPassword(req: Request, res: Response): Promise<Response> {
    try {
      const parsed = forgotPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          status: "error",
          message: "Validation failed",
          errors: parsed.error.errors.map((e) => e.message),
        } as ApiResponse);
      }

      const result = await UserService.forgotPassword(parsed.data.email);

      return res.status(200).json({
        status: "success",
        message: result.message,
      } as ApiResponse);
    } catch (error) {
      return UserController.handleError(
        error as Error,
        res,
        "Failed to process password reset request"
      );
    }
  }

  static async resetPassword(req: Request, res: Response): Promise<Response> {
    try {
      const parsed = resetPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          status: "error",
          message: "Validation failed",
          errors: parsed.error.errors.map((e) => e.message),
        } as ApiResponse);
      }

      const result = await UserService.resetPassword(
        parsed.data.token,
        parsed.data.newPassword
      );

      return res.status(200).json({
        status: "success",
        message: result.message,
      } as ApiResponse);
    } catch (error) {
      return UserController.handleError(
        error as Error,
        res,
        "Failed to reset password"
      );
    }
  }

  static async getProfile(req: Request, res: Response) {
    try {
      const data = await UserService.getProfile(req.userId!);
      return res.status(200).json({ status: "success", data });
    } catch (error: any) {
      if (error.name === "UserNotFoundError") {
        return res.status(404).json({ status: "error", message: error.message });
      }
      return res.status(500).json({ status: "error", message: error.message });
    }
  }

  static async updateProfile(req: Request, res: Response) {
    try {
      const data = await UserService.updateProfile(req.userId!, req.body);
      return res.status(200).json({ status: "success", message: "Profile updated", data });
    } catch (error: any) {
      if (error.name === "UserNotFoundError") {
        return res.status(404).json({ status: "error", message: error.message });
      }
      return res.status(500).json({ status: "error", message: error.message });
    }
  }

  static async changePassword(req: Request, res: Response) {
    try {
      const { currentPassword, newPassword } = req.body;
      const data = await UserService.changePassword(req.userId!, currentPassword, newPassword);
      return res.status(200).json({ status: "success", ...data });
    } catch (error: any) {
      if (error.name === "UserValidationError") {
        return res.status(400).json({ status: "error", message: error.message });
      }
      if (error.name === "UserNotFoundError") {
        return res.status(404).json({ status: "error", message: error.message });
      }
      return res.status(500).json({ status: "error", message: error.message });
    }
  }

  static async oauthLogin(req: Request, res: Response) {
    try {
      const { code, provider } = req.body;
      const { OAuthService } = require("../services/oauth.service");
      const result = await OAuthService.login(code, provider);
      return res.status(200).json({ status: "success", data: result });
    } catch (error: any) {
      if (error.name === "UserValidationError") {
        return res.status(400).json({ status: "error", message: error.message });
      }
      return res.status(500).json({ status: "error", message: error.message });
    }
  }
}
