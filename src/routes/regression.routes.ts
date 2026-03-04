import { Router } from "express";
import { RegressionController } from "../controllers/regression.controller";
import { verifyToken } from "../middleware/auth.middleware";

const router = Router();

router.use(verifyToken);

router.get("/:projectId/detect", RegressionController.detectRegressions);
router.get("/:projectId/baseline", RegressionController.getBaseline);
router.post("/:projectId/compare", RegressionController.comparePerformance);

export default router;
