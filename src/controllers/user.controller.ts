import { Request, Response } from "express";
import { UserService, UserValidationError } from "../services/user.service";
import { CreateUserDTO } from "../dtos/user.dto";

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
}
