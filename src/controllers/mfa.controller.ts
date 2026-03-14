import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { MfaService, MfaValidationError } from "../services/mfa.service";
import { UserModel } from "../models/user.model";

dotenv.config();

interface MfaJwtPayload {
  userId: string;
  mfaRequired: boolean;
}

interface ApiResponse<T = any> {
  status: "success" | "error";
  message?: string;
  data?: T;
  errors?: string[];
}

export class MfaController {
  /**
   * POST /users/mfa/setup
   * Initiate MFA setup - returns QR code and backup codes.
   * Requires JWT auth.
   */
  static async setupMfa(req: Request, res: Response): Promise<Response> {
    try {
      const result = await MfaService.setupMfa(req.userId!);

      return res.status(200).json({
        status: "success",
        message: "MFA setup initiated",
        data: {
          qrCodeDataUrl: result.qrCodeDataUrl,
          secret: result.secret,
          backupCodes: result.backupCodes,
        },
      } as ApiResponse);
    } catch (error) {
      if (error instanceof MfaValidationError) {
        return res.status(400).json({
          status: "error",
          message: error.message,
        } as ApiResponse);
      }
      console.error("MFA setup error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to set up MFA",
      } as ApiResponse);
    }
  }

  /**
   * POST /users/mfa/verify
   * Verify TOTP code and enable MFA.
   * Requires JWT auth.
   * Body: { token: string, backupCodes: string[] }
   */
  static async verifyMfa(req: Request, res: Response): Promise<Response> {
    try {
      const { token, backupCodes } = req.body;

      if (!token || typeof token !== "string") {
        return res.status(400).json({
          status: "error",
          message: "TOTP code is required",
        } as ApiResponse);
      }

      if (!backupCodes || !Array.isArray(backupCodes)) {
        return res.status(400).json({
          status: "error",
          message: "Backup codes are required",
        } as ApiResponse);
      }

      await MfaService.verifyAndEnable(req.userId!, token, backupCodes);

      return res.status(200).json({
        status: "success",
        message: "MFA enabled successfully",
      } as ApiResponse);
    } catch (error) {
      if (error instanceof MfaValidationError) {
        return res.status(400).json({
          status: "error",
          message: error.message,
        } as ApiResponse);
      }
      console.error("MFA verify error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to verify MFA",
      } as ApiResponse);
    }
  }

  /**
   * POST /users/mfa/disable
   * Disable MFA (requires current TOTP code).
   * Requires JWT auth.
   * Body: { token: string }
   */
  static async disableMfa(req: Request, res: Response): Promise<Response> {
    try {
      const { token } = req.body;

      if (!token || typeof token !== "string") {
        return res.status(400).json({
          status: "error",
          message: "TOTP code is required to disable MFA",
        } as ApiResponse);
      }

      await MfaService.disableMfa(req.userId!, token);

      return res.status(200).json({
        status: "success",
        message: "MFA disabled successfully",
      } as ApiResponse);
    } catch (error) {
      if (error instanceof MfaValidationError) {
        return res.status(400).json({
          status: "error",
          message: error.message,
        } as ApiResponse);
      }
      console.error("MFA disable error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to disable MFA",
      } as ApiResponse);
    }
  }

  /**
   * POST /users/mfa/validate
   * Validate TOTP during login flow.
   * Does NOT require JWT auth - uses the short-lived mfaToken from login.
   * Body: { mfaToken: string, token: string }
   */
  static async validateMfa(req: Request, res: Response): Promise<Response> {
    try {
      const { mfaToken, token } = req.body;

      if (!mfaToken || typeof mfaToken !== "string") {
        return res.status(400).json({
          status: "error",
          message: "MFA token is required",
        } as ApiResponse);
      }

      if (!token || typeof token !== "string") {
        return res.status(400).json({
          status: "error",
          message: "TOTP code is required",
        } as ApiResponse);
      }

      const secret = process.env.JWT_SECRET;
      if (!secret) {
        return res.status(500).json({
          status: "error",
          message: "Authentication service misconfigured",
        } as ApiResponse);
      }

      // Verify the short-lived MFA token
      let decoded: MfaJwtPayload;
      try {
        decoded = jwt.verify(mfaToken, secret) as MfaJwtPayload;
      } catch {
        return res.status(401).json({
          status: "error",
          message: "MFA session expired. Please log in again.",
        } as ApiResponse);
      }

      if (!decoded.mfaRequired) {
        return res.status(400).json({
          status: "error",
          message: "Invalid MFA token",
        } as ApiResponse);
      }

      // Validate the TOTP code
      await MfaService.validateToken(decoded.userId, token);

      // Issue full JWT
      const user = await UserModel.findById(decoded.userId).select(
        "-password -mfaSecret -mfaBackupCodes -resetPasswordToken -resetPasswordExpires -accessToken -refreshToken"
      );
      if (!user) {
        return res.status(404).json({
          status: "error",
          message: "User not found",
        } as ApiResponse);
      }

      const authToken = jwt.sign(
        {
          userId: user._id,
          role: user.role,
          betaAccess: user.betaAccess,
          betaTier: user.betaTier,
        },
        secret,
        { expiresIn: "10h" }
      );

      return res.status(200).json({
        status: "success",
        message: "MFA validation successful",
        data: {
          _id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          token: authToken,
          joinedAt: user.joinedAt,
        },
      } as ApiResponse);
    } catch (error) {
      if (error instanceof MfaValidationError) {
        return res.status(400).json({
          status: "error",
          message: error.message,
        } as ApiResponse);
      }
      console.error("MFA validate error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to validate MFA",
      } as ApiResponse);
    }
  }

  /**
   * GET /users/mfa/status
   * Get MFA status for the authenticated user.
   * Requires JWT auth.
   */
  static async getMfaStatus(req: Request, res: Response): Promise<Response> {
    try {
      const result = await MfaService.getMfaStatus(req.userId!);

      return res.status(200).json({
        status: "success",
        data: result,
      } as ApiResponse);
    } catch (error) {
      if (error instanceof MfaValidationError) {
        return res.status(400).json({
          status: "error",
          message: error.message,
        } as ApiResponse);
      }
      console.error("MFA status error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to get MFA status",
      } as ApiResponse);
    }
  }
}
