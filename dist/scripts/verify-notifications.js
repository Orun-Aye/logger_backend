"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// scripts/verify-notifications.ts
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const notification_service_1 = require("../src/services/notification.service");
const notification_model_1 = __importDefault(require("../src/models/notification.model"));
dotenv_1.default.config();
async function verify() {
    try {
        console.log("Connecting to DB...");
        if (!process.env.MONGODB_URI) {
            throw new Error("MONGODB_URI is missing");
        }
        await mongoose_1.default.connect(process.env.MONGODB_URI);
        console.log("Connected.");
        const testUserId = new mongoose_1.default.Types.ObjectId();
        console.log(`Testing with User ID: ${testUserId}`);
        // Test In-App Notification
        console.log("Sending In-App Notification...");
        const notification = await notification_service_1.NotificationService.sendInApp(testUserId.toString(), "info", "This is a test notification from the verification script.");
        console.log("Notification created:", notification);
        // Verify it exists in DB
        const found = await notification_model_1.default.findById(notification?._id);
        if (found) {
            console.log("✅ Verification Successful: Notification found in DB.");
        }
        else {
            console.error("❌ Verification Failed: Notification not found in DB.");
        }
        // Test Email (Mock)
        console.log("Sending Email (Mock)...");
        await notification_service_1.NotificationService.sendEmail(["test@example.com"], "Test Subject", "Test Body");
        console.log("✅ Email send function called (check logs for output).");
    }
    catch (error) {
        console.error("Verification failed:", error);
    }
    finally {
        await mongoose_1.default.disconnect();
    }
}
verify();
