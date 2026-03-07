import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";
import crypto from "crypto";
import { UserModel } from "../models/user.model";

export class MfaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MfaValidationError";
  }
}

/**
 * Helper to verify a TOTP token against a secret.
 * Returns true if valid, false otherwise.
 */
async function verifyTotp(token: string, secret: string): Promise<boolean> {
  try {
    const result = await verify({ token, secret });
    return result.valid;
  } catch {
    return false;
  }
}

export class MfaService {
  /**
   * Generate a new TOTP secret, QR code data URL, and backup codes.
   * The secret is stored on the user but MFA is NOT yet enabled
   * until verifyAndEnable() is called.
   */
  static async setupMfa(userId: string) {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new MfaValidationError("User not found");
    }
    if (user.mfaEnabled) {
      throw new MfaValidationError("MFA is already enabled");
    }

    const secret = generateSecret();
    const otpauth = generateURI({
      issuer: "Monita",
      label: user.email,
      secret,
    });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauth);

    // Store the secret temporarily (MFA not yet active)
    user.mfaSecret = secret;
    await user.save();

    // Generate 8 random backup codes
    const backupCodes = Array.from({ length: 8 }, () =>
      crypto.randomBytes(4).toString("hex")
    );

    return { secret, qrCodeDataUrl, backupCodes };
  }

  /**
   * Verify the user's TOTP token and enable MFA.
   * Also stores hashed backup codes.
   */
  static async verifyAndEnable(
    userId: string,
    token: string,
    backupCodes: string[]
  ) {
    const user = await UserModel.findById(userId);
    if (!user || !user.mfaSecret) {
      throw new MfaValidationError("MFA setup not initiated");
    }

    const isValid = await verifyTotp(token, user.mfaSecret);
    if (!isValid) {
      throw new MfaValidationError("Invalid verification code");
    }

    // Hash and store backup codes
    user.mfaBackupCodes = backupCodes.map((code) =>
      crypto.createHash("sha256").update(code).digest("hex")
    );
    user.mfaEnabled = true;
    await user.save();

    return true;
  }

  /**
   * Validate a TOTP token during login.
   * Also supports backup codes (single-use).
   */
  static async validateToken(userId: string, token: string) {
    const user = await UserModel.findById(userId);
    if (!user || !user.mfaSecret) {
      throw new MfaValidationError("MFA not configured");
    }

    // Check TOTP token first
    const isValid = await verifyTotp(token, user.mfaSecret);
    if (isValid) return true;

    // Check backup codes
    const tokenHash = crypto
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
  static async disableMfa(userId: string, token: string) {
    const user = await UserModel.findById(userId);
    if (!user || !user.mfaEnabled) {
      throw new MfaValidationError("MFA is not enabled");
    }

    // Require valid TOTP before disabling
    const isValid = await verifyTotp(token, user.mfaSecret!);
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
  static async getMfaStatus(userId: string) {
    const user = await UserModel.findById(userId).select(
      "mfaEnabled mfaBackupCodes"
    );
    if (!user) {
      throw new MfaValidationError("User not found");
    }

    return {
      mfaEnabled: user.mfaEnabled,
      backupCodesRemaining: user.mfaBackupCodes?.length || 0,
    };
  }
}
