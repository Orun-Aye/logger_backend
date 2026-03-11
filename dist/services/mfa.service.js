"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MfaService = exports.MfaValidationError = void 0;
const otplib_1 = require("otplib");
const qrcode_1 = __importDefault(require("qrcode"));
const crypto_1 = __importDefault(require("crypto"));
const user_model_1 = require("../models/user.model");
class MfaValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "MfaValidationError";
    }
}
exports.MfaValidationError = MfaValidationError;
/**
 * Helper to verify a TOTP token against a secret.
 * Returns true if valid, false otherwise.
 */
async function verifyTotp(token, secret) {
    try {
        const result = await (0, otplib_1.verify)({ token, secret });
        return result.valid;
    }
    catch {
        return false;
    }
}
class MfaService {
    /**
     * Generate a new TOTP secret, QR code data URL, and backup codes.
     * The secret is stored on the user but MFA is NOT yet enabled
     * until verifyAndEnable() is called.
     */
    static async setupMfa(userId) {
        const user = await user_model_1.UserModel.findById(userId);
        if (!user) {
            throw new MfaValidationError("User not found");
        }
        if (user.mfaEnabled) {
            throw new MfaValidationError("MFA is already enabled");
        }
        const secret = (0, otplib_1.generateSecret)();
        const otpauth = (0, otplib_1.generateURI)({
            issuer: "Apperio",
            label: user.email,
            secret,
        });
        const qrCodeDataUrl = await qrcode_1.default.toDataURL(otpauth);
        // Store the secret temporarily (MFA not yet active)
        user.mfaSecret = secret;
        await user.save();
        // Generate 8 random backup codes
        const backupCodes = Array.from({ length: 8 }, () => crypto_1.default.randomBytes(4).toString("hex"));
        return { secret, qrCodeDataUrl, backupCodes };
    }
    /**
     * Verify the user's TOTP token and enable MFA.
     * Also stores hashed backup codes.
     */
    static async verifyAndEnable(userId, token, backupCodes) {
        const user = await user_model_1.UserModel.findById(userId);
        if (!user || !user.mfaSecret) {
            throw new MfaValidationError("MFA setup not initiated");
        }
        const isValid = await verifyTotp(token, user.mfaSecret);
        if (!isValid) {
            throw new MfaValidationError("Invalid verification code");
        }
        // Hash and store backup codes
        user.mfaBackupCodes = backupCodes.map((code) => crypto_1.default.createHash("sha256").update(code).digest("hex"));
        user.mfaEnabled = true;
        await user.save();
        return true;
    }
    /**
     * Validate a TOTP token during login.
     * Also supports backup codes (single-use).
     */
    static async validateToken(userId, token) {
        const user = await user_model_1.UserModel.findById(userId);
        if (!user || !user.mfaSecret) {
            throw new MfaValidationError("MFA not configured");
        }
        // Check TOTP token first
        const isValid = await verifyTotp(token, user.mfaSecret);
        if (isValid)
            return true;
        // Check backup codes
        const tokenHash = crypto_1.default
            .createHash("sha256")
            .update(token)
            .digest("hex");
        const backupIndex = user.mfaBackupCodes.indexOf(tokenHash);
        if (backupIndex !== -1) {
            // Remove the used backup code (single-use)
            user.mfaBackupCodes.splice(backupIndex, 1);
            await user.save();
            return true;
        }
        throw new MfaValidationError("Invalid MFA code");
    }
    /**
     * Disable MFA after verifying the user's current TOTP token.
     */
    static async disableMfa(userId, token) {
        const user = await user_model_1.UserModel.findById(userId);
        if (!user || !user.mfaEnabled) {
            throw new MfaValidationError("MFA is not enabled");
        }
        // Require valid TOTP before disabling
        const isValid = await verifyTotp(token, user.mfaSecret);
        if (!isValid) {
            throw new MfaValidationError("Invalid verification code");
        }
        user.mfaEnabled = false;
        user.mfaSecret = undefined;
        user.mfaBackupCodes = [];
        await user.save();
        return true;
    }
    /**
     * Get MFA status for a user (safe for API response).
     */
    static async getMfaStatus(userId) {
        const user = await user_model_1.UserModel.findById(userId).select("mfaEnabled mfaBackupCodes");
        if (!user) {
            throw new MfaValidationError("User not found");
        }
        return {
            mfaEnabled: user.mfaEnabled,
            backupCodesRemaining: user.mfaBackupCodes?.length || 0,
        };
    }
}
exports.MfaService = MfaService;
