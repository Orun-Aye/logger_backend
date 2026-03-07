import { Router } from "express";
import { UserController } from "../controllers/user.controller";
import { MfaController } from "../controllers/mfa.controller";
import { GdprController } from "../controllers/gdpr.controller";
import { verifyToken } from "../middleware/auth.middleware";
import { validate } from "../middleware/validation.middleware";
import { updateProfileSchema, changePasswordSchema, oauthLoginSchema } from "../validators/user.validator";

const router = Router();

// Public routes
router.post("/signup", UserController.createUser);
router.post("/login", UserController.loginUser);
router.post("/forgot-password", UserController.forgotPassword);
router.post("/reset-password", UserController.resetPassword);
router.post("/oauth/login", validate(oauthLoginSchema, "body"), UserController.oauthLogin);

// MFA public route (uses mfaToken, not JWT)
router.post("/mfa/validate", MfaController.validateMfa);

// Protected routes (require JWT)
router.get("/profile", verifyToken, UserController.getProfile);
router.put("/profile", verifyToken, validate(updateProfileSchema, "body"), UserController.updateProfile);
router.put("/change-password", verifyToken, validate(changePasswordSchema, "body"), UserController.changePassword);

// MFA protected routes (require JWT)
router.post("/mfa/setup", verifyToken, MfaController.setupMfa);
router.post("/mfa/verify", verifyToken, MfaController.verifyMfa);
router.post("/mfa/disable", verifyToken, MfaController.disableMfa);
router.get("/mfa/status", verifyToken, MfaController.getMfaStatus);

// GDPR data export and deletion (require JWT)
router.post("/data-export", verifyToken, GdprController.exportData);
router.post("/data-deletion", verifyToken, GdprController.deleteAccount);

export default router;
