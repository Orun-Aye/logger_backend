// @ts-nocheck

import nodemailer from "nodemailer";
import Notification from "../models/notification.model";
import { globalServices } from "../server";

export class NotificationService {
  private static transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.ethereal.email",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  static async sendEmail(
    to: string[],
    subject: string,
    text: string,
    html?: string
  ) {
    if (!to?.length) return;
    try {
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM || '"LogHive" <no-reply@loghive.com>',
        to: to.join(", "),
        subject,
        text,
        html,
      });
      console.log(`[Notification] Email sent: ${info.messageId}`);
    } catch (error) {
      console.error("[Notification] Email failed:", error);
    }
  }

  static async sendSlack(webhookUrl: string, message: string) {
    if (!webhookUrl) return;
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message }),
      });
    } catch (err) {
      console.error("Failed to send Slack notification", err);
    }
  }

  static async sendDiscord(webhookUrl: string, message: string) {
    if (!webhookUrl) return;
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message }),
      });
    } catch (err) {
      console.error("Failed to send Discord notification", err);
    }
  }

  static async sendInApp(
    userId: string,
    type: "info" | "warning" | "error" | "success",
    message: string,
    metadata?: any
  ) {
    try {
      const notification = await Notification.create({
        userId,
        type,
        message,
        metadata,
      });

      // Real-time update via WebSocket
      if (globalServices.dashboardWebSocketService) {
        globalServices.dashboardWebSocketService.sendToUser(
          userId,
          "NOTIFICATION",
          notification
        );
      }

      return notification;
    } catch (error) {
      console.error("[Notification] In-App failed:", error);
    }
  }
}
