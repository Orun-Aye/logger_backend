import { Router } from "express";
import { AlertEventController } from "../controllers/alertEvent.controller";
import { verifyToken } from "../middleware/auth.middleware";

const router = Router();

router.use(verifyToken);

router.get("/:projectId/alerts", AlertEventController.list);
router.post("/alerts/:alertId/acknowledge", AlertEventController.acknowledge);

export default router;


