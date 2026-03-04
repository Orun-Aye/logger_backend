import { Router } from "express";
import { FunnelController } from "../controllers/funnel.controller";
import { verifyToken } from "../middleware/auth.middleware";
import { validate } from "../middleware/validation.middleware";
import { analyzeFunnelSchema } from "../validators/funnel.validator";

const router = Router();

router.use(verifyToken);

router.post("/:projectId/analyze", validate(analyzeFunnelSchema, "body"), FunnelController.analyzeFunnel);
router.get("/:projectId/popular-paths", FunnelController.getPopularPaths);

export default router;
