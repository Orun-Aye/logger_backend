import { Router } from "express";
import { AISuggestionController } from "../controllers/aiSuggestion.controller";
import { verifyToken } from "../middleware/auth.middleware";
import { validate } from "../middleware/validation.middleware";
import { acceptSuggestionSchema } from "../validators/aiSuggestion.validator";

const router = Router();

router.use(verifyToken);

router.get("/:projectId/suggestions", AISuggestionController.getSuggestions);
router.post("/:projectId/suggestions/accept", validate(acceptSuggestionSchema, "body"), AISuggestionController.acceptSuggestion);

export default router;
