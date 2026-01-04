import { Request, Response } from "express";
import Notification from "../models/notification.model";
import { NotificationService } from "../services/notification.service";

export class NotificationController {
  static async getNotifications(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      const notifications = await Notification.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Notification.countDocuments({ userId });
      const unreadCount = await Notification.countDocuments({
        userId,
        read: false,
      });

      res.json({
        notifications,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
        unreadCount,
      });
    } catch (error) {
      console.error("Get notifications error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  static async markAsRead(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId;

      const notification = await Notification.findOneAndUpdate(
        { _id: id, userId },
        { read: true },
        { new: true }
      );

      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }

      res.json(notification);
    } catch (error) {
      console.error("Mark as read error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  static async markAllAsRead(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;

      await Notification.updateMany({ userId, read: false }, { read: true });

      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      console.error("Mark all as read error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  // Test endpoint to trigger a notification manually (for verification)
  static async testNotification(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const { type, message } = req.body;

      await NotificationService.sendInApp(
        userId,
        type || "info",
        message || "Test notification"
      );
      res.json({ message: "Notification sent" });
    } catch (error) {
      res.status(500).json({ message: "Failed to send test notification" });
    }
  }
}
