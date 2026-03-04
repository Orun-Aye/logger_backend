import { Router } from "express";
import { UserController } from "../controllers/user.controller";
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

// Protected routes (require JWT)
router.get("/profile", verifyToken, UserController.getProfile);
router.put("/profile", verifyToken, validate(updateProfileSchema, "body"), UserController.updateProfile);
router.put("/change-password", verifyToken, validate(changePasswordSchema, "body"), UserController.changePassword);

export default router;
