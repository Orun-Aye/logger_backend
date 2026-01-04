import { Router } from "express";
import { NotificationController } from "../controllers/notification.controller";
import { verifyToken as authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.use(authMiddleware);

router.get("/", NotificationController.getNotifications);
router.patch("/read-all", NotificationController.markAllAsRead);
router.patch("/:id/read", NotificationController.markAsRead);
router.post("/test", NotificationController.testNotification);

export default router;
