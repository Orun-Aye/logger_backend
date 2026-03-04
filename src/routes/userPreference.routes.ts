import { Router } from "express";
import { UserPreferenceController } from "../controllers/userPreference.controller";
import { verifyToken } from "../middleware/auth.middleware";
import { validate } from "../middleware/validation.middleware";
import { favoriteProjectSchema } from "../validators/userPreference.validator";

const router = Router();

router.use(verifyToken);

router.get("/favorites", UserPreferenceController.getFavorites);
router.post("/favorites", validate(favoriteProjectSchema, "body"), UserPreferenceController.addFavorite);
router.delete("/favorites", validate(favoriteProjectSchema, "body"), UserPreferenceController.removeFavorite);
router.get("/favorites/:projectId", UserPreferenceController.checkFavorite);

export default router;
