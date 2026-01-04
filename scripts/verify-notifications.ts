// scripts/verify-notifications.ts
import mongoose from "mongoose";
import dotenv from "dotenv";
import { NotificationService } from "../src/services/notification.service";
import Notification from "../src/models/notification.model";

dotenv.config();

async function verify() {
  try {
    console.log("Connecting to DB...");
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is missing");
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected.");

    const testUserId = new mongoose.Types.ObjectId();
    console.log(`Testing with User ID: ${testUserId}`);

    // Test In-App Notification
    console.log("Sending In-App Notification...");
    const notification = await NotificationService.sendInApp(
      testUserId.toString(),
      "info",
      "This is a test notification from the verification script."
    );
    console.log("Notification created:", notification);

    // Verify it exists in DB
    const found = await Notification.findById(notification?._id);
    if (found) {
      console.log("✅ Verification Successful: Notification found in DB.");
    } else {
      console.error("❌ Verification Failed: Notification not found in DB.");
    }

    // Test Email (Mock)
    console.log("Sending Email (Mock)...");
    await NotificationService.sendEmail(
      ["test@example.com"],
      "Test Subject",
      "Test Body"
    );
    console.log("✅ Email send function called (check logs for output).");
  } catch (error) {
    console.error("Verification failed:", error);
  } finally {
    await mongoose.disconnect();
  }
}

verify();
