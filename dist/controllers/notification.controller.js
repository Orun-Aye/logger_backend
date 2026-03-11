"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationController = void 0;
const notification_model_1 = __importDefault(require("../models/notification.model"));
const notification_service_1 = require("../services/notification.service");
class NotificationController {
    static async getNotifications(req, res) {
        try {
            const userId = req.userId;
            if (!userId) {
                return res.status(401).json({ message: "Unauthorized" });
            }
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const skip = (page - 1) * limit;
            const notifications = await notification_model_1.default.find({ userId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);
            const total = await notification_model_1.default.countDocuments({ userId });
            const unreadCount = await notification_model_1.default.countDocuments({
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
        }
        catch (error) {
            console.error("Get notifications error:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }
    static async markAsRead(req, res) {
        try {
            const { id } = req.params;
            const userId = req.userId;
            const notification = await notification_model_1.default.findOneAndUpdate({ _id: id, userId }, { read: true }, { new: true });
            if (!notification) {
                return res.status(404).json({ message: "Notification not found" });
            }
            res.json(notification);
        }
        catch (error) {
            console.error("Mark as read error:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }
    static async markAllAsRead(req, res) {
        try {
            const userId = req.userId;
            await notification_model_1.default.updateMany({ userId, read: false }, { read: true });
            res.json({ message: "All notifications marked as read" });
        }
        catch (error) {
            console.error("Mark all as read error:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }
    // Test endpoint to trigger a notification manually (for verification)
    static async testNotification(req, res) {
        try {
            const userId = req.userId;
            const { type, message } = req.body;
            await notification_service_1.NotificationService.sendInApp(userId, type || "info", message || "Test notification");
            res.json({ message: "Notification sent" });
        }
        catch (error) {
            res.status(500).json({ message: "Failed to send test notification" });
        }
    }
}
exports.NotificationController = NotificationController;
