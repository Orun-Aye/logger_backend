"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MfaController = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dotenv_1 = __importDefault(require("dotenv"));
const mfa_service_1 = require("../services/mfa.service");
const user_model_1 = require("../models/user.model");
dotenv_1.default.config();
class MfaController {
    /**
     * POST /users/mfa/setup
     * Initiate MFA setup - returns QR code and backup codes.
     * Requires JWT auth.
     */
    static async setupMfa(req, res) {
        try {
            const result = await mfa_service_1.MfaService.setupMfa(req.userId);
            return res.status(200).json({
                status: "success",
                message: "MFA setup initiated",
                data: {
                    qrCodeDataUrl: result.qrCodeDataUrl,
                    secret: result.secret,
                    backupCodes: result.backupCodes,
                },
            });
        }
        catch (error) {
            if (error instanceof mfa_service_1.MfaValidationError) {
                return res.status(400).json({
                    status: "error",
                    message: error.message,
                });
            }
            console.error("MFA setup error:", error);
            return res.status(500).json({
                status: "error",
                message: "Failed to set up MFA",
            });
        }
    }
    /**
     * POST /users/mfa/verify
     * Verify TOTP code and enable MFA.
     * Requires JWT auth.
     * Body: { token: string, backupCodes: string[] }
     */
    static async verifyMfa(req, res) {
        try {
            const { token, backupCodes } = req.body;
            if (!token || typeof token !== "string") {
                return res.status(400).json({
                    status: "error",
                    message: "TOTP code is required",
                });
            }
            if (!backupCodes || !Array.isArray(backupCodes)) {
                return res.status(400).json({
                    status: "error",
                    message: "Backup codes are required",
                });
            }
            await mfa_service_1.MfaService.verifyAndEnable(req.userId, token, backupCodes);
            return res.status(200).json({
                status: "success",
                message: "MFA enabled successfully",
            });
        }
        catch (error) {
            if (error instanceof mfa_service_1.MfaValidationError) {
                return res.status(400).json({
                    status: "error",
                    message: error.message,
                });
            }
            console.error("MFA verify error:", error);
            return res.status(500).json({
                status: "error",
                message: "Failed to verify MFA",
            });
        }
    }
    /**
     * POST /users/mfa/disable
     * Disable MFA (requires current TOTP code).
     * Requires JWT auth.
     * Body: { token: string }
     */
    static async disableMfa(req, res) {
        try {
            const { token } = req.body;
            if (!token || typeof token !== "string") {
                return res.status(400).json({
                    status: "error",
                    message: "TOTP code is required to disable MFA",
                });
            }
            await mfa_service_1.MfaService.disableMfa(req.userId, token);
            return res.status(200).json({
                status: "success",
                message: "MFA disabled successfully",
            });
        }
        catch (error) {
            if (error instanceof mfa_service_1.MfaValidationError) {
                return res.status(400).json({
                    status: "error",
                    message: error.message,
                });
            }
            console.error("MFA disable error:", error);
            return res.status(500).json({
                status: "error",
                message: "Failed to disable MFA",
            });
        }
    }
    /**
     * POST /users/mfa/validate
     * Validate TOTP during login flow.
     * Does NOT require JWT auth - uses the short-lived mfaToken from login.
     * Body: { mfaToken: string, token: string }
     */
    static async validateMfa(req, res) {
        try {
            const { mfaToken, token } = req.body;
            if (!mfaToken || typeof mfaToken !== "string") {
                return res.status(400).json({
                    status: "error",
                    message: "MFA token is required",
                });
            }
            if (!token || typeof token !== "string") {
                return res.status(400).json({
                    status: "error",
                    message: "TOTP code is required",
                });
            }
            const secret = process.env.JWT_SECRET;
            if (!secret) {
                return res.status(500).json({
                    status: "error",
                    message: "Authentication service misconfigured",
                });
            }
            // Verify the short-lived MFA token
            let decoded;
            try {
                decoded = jsonwebtoken_1.default.verify(mfaToken, secret);
            }
            catch {
                return res.status(401).json({
                    status: "error",
                    message: "MFA session expired. Please log in again.",
                });
            }
            if (!decoded.mfaRequired) {
                return res.status(400).json({
                    status: "error",
                    message: "Invalid MFA token",
                });
            }
            // Validate the TOTP code
            await mfa_service_1.MfaService.validateToken(decoded.userId, token);
            // Issue full JWT
            const user = await user_model_1.UserModel.findById(decoded.userId).select("-password -mfaSecret -mfaBackupCodes -resetPasswordToken -resetPasswordExpires -accessToken -refreshToken");
            if (!user) {
                return res.status(404).json({
                    status: "error",
                    message: "User not found",
                });
            }
            const authToken = jsonwebtoken_1.default.sign({
                userId: user._id,
                role: user.role,
                betaAccess: user.betaAccess,
                betaTier: user.betaTier,
            }, secret, { expiresIn: "10h" });
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
            });
        }
        catch (error) {
            if (error instanceof mfa_service_1.MfaValidationError) {
                return res.status(400).json({
                    status: "error",
                    message: error.message,
                });
            }
            console.error("MFA validate error:", error);
            return res.status(500).json({
                status: "error",
                message: "Failed to validate MFA",
            });
        }
    }
    /**
     * GET /users/mfa/status
     * Get MFA status for the authenticated user.
     * Requires JWT auth.
     */
    static async getMfaStatus(req, res) {
        try {
            const result = await mfa_service_1.MfaService.getMfaStatus(req.userId);
            return res.status(200).json({
                status: "success",
                data: result,
            });
        }
        catch (error) {
            if (error instanceof mfa_service_1.MfaValidationError) {
                return res.status(400).json({
                    status: "error",
                    message: error.message,
                });
            }
            console.error("MFA status error:", error);
            return res.status(500).json({
                status: "error",
                message: "Failed to get MFA status",
            });
        }
    }
}
exports.MfaController = MfaController;
