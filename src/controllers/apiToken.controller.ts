import { Request, Response } from "express";
import {
  ApiTokenService,
  ApiTokenValidationError,
  ApiTokenNotFoundError,
} from "../services/apiToken.service";
import { API_TOKEN_SCOPES, ApiTokenScope } from "../models/apiToken.model";

interface ApiResponse<T = any> {
  status: "success" | "error";
  message?: string;
  data?: T;
  errors?: string[];
}

export class ApiTokenController {
  private static handleError(
    error: Error,
    res: Response,
    defaultMessage: string
  ): Response {
    console.error(`ApiTokenController Error: ${error.message}`, error.stack);

    if (error instanceof ApiTokenValidationError) {
      return res.status(400).json({
        status: "error",
        message: error.message,
        errors: [error.message],
      } as ApiResponse);
    }

    if (error instanceof ApiTokenNotFoundError) {
      return res.status(404).json({
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

  /**
   * POST /api/v1/tokens
   * Create a new personal API token. Returns the raw token exactly once.
   */
  static async createToken(req: Request, res: Response): Promise<Response> {
    try {
      const { name, scopes, expiresAt } = req.body;

      if (!name || typeof name !== "string") {
        return res.status(400).json({
          status: "error",
          message: "Token name is required",
        } as ApiResponse);
      }

      if (!scopes || !Array.isArray(scopes) || scopes.length === 0) {
        return res.status(400).json({
          status: "error",
          message: "At least one scope is required",
        } as ApiResponse);
      }

      // Validate scopes
      const invalidScopes = scopes.filter(
        (s: string) => !API_TOKEN_SCOPES.includes(s as ApiTokenScope)
      );
      if (invalidScopes.length > 0) {
        return res.status(400).json({
          status: "error",
          message: `Invalid scopes: ${invalidScopes.join(", ")}`,
        } as ApiResponse);
      }

      // Parse expiration
      let parsedExpiry: Date | null = null;
      if (expiresAt) {
        parsedExpiry = new Date(expiresAt);
        if (isNaN(parsedExpiry.getTime())) {
          return res.status(400).json({
            status: "error",
            message: "Invalid expiration date",
          } as ApiResponse);
        }
        if (parsedExpiry <= new Date()) {
          return res.status(400).json({
            status: "error",
            message: "Expiration date must be in the future",
          } as ApiResponse);
        }
      }

      const result = await ApiTokenService.createToken(
        req.userId!,
        name,
        scopes as ApiTokenScope[],
        parsedExpiry
      );

      return res.status(201).json({
        status: "success",
        message: "API token created successfully. Copy the token now — it will not be shown again.",
        data: {
          ...result.token,
          rawToken: result.rawToken,
        },
      } as ApiResponse);
    } catch (error) {
      return ApiTokenController.handleError(
        error as Error,
        res,
        "Failed to create API token"
      );
    }
  }

  /**
   * GET /api/v1/tokens
   * List all active tokens for the authenticated user.
   */
  static async listTokens(req: Request, res: Response): Promise<Response> {
    try {
      const tokens = await ApiTokenService.listTokens(req.userId!);

      return res.status(200).json({
        status: "success",
        data: tokens,
      } as ApiResponse);
    } catch (error) {
      return ApiTokenController.handleError(
        error as Error,
        res,
        "Failed to list API tokens"
      );
    }
  }

  /**
   * DELETE /api/v1/tokens/:tokenId
   * Revoke (deactivate) a token.
   */
  static async revokeToken(req: Request, res: Response): Promise<Response> {
    try {
      const { tokenId } = req.params;

      if (!tokenId) {
        return res.status(400).json({
          status: "error",
          message: "Token ID is required",
        } as ApiResponse);
      }

      const token = await ApiTokenService.revokeToken(tokenId, req.userId!);

      return res.status(200).json({
        status: "success",
        message: "API token revoked successfully",
        data: token,
      } as ApiResponse);
    } catch (error) {
      return ApiTokenController.handleError(
        error as Error,
        res,
        "Failed to revoke API token"
      );
    }
  }
}
