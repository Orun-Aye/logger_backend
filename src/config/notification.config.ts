// src/config/notification.config.ts

import nodemailer from "nodemailer";
import { config } from "./index";
import logger from "../utils/logger";

/**
 * Email transporter (lazy initialization)
 */
let emailTransporter: nodemailer.Transporter | null = null;

/**
 * Get email transporter
 */
export function getEmailTransporter(): nodemailer.Transporter {
  if (!config.email.enabled) {
    throw new Error("Email is not enabled in configuration");
  }

  if (!emailTransporter) {
    emailTransporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: {
        user: config.email.user,
        pass: config.email.password,
      },
    });

    logger.info("Email transporter initialized", {
      host: config.email.host,
      port: config.email.port,
    });
  }

  return emailTransporter;
}

/**
 * Send email
 */
export async function sendEmail(options: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  if (!config.email.enabled) {
    logger.warn("Email sending skipped - email not enabled");
    return;
  }

  try {
    const transporter = getEmailTransporter();

    await transporter.sendMail({
      from: config.email.from,
      to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    logger.info("Email sent successfully", {
      to: options.to,
      subject: options.subject,
    });
  } catch (error) {
    logger.error("Failed to send email", {
      error: error instanceof Error ? error.message : "Unknown error",
      to: options.to,
      subject: options.subject,
    });
    throw error;
  }
}

/**
 * Send Slack notification
 */
export async function sendSlackNotification(
  webhookUrl: string,
  message: {
    text: string;
    blocks?: any[];
  }
): Promise<void> {
  if (!config.slack.enabled) {
    logger.warn("Slack notification skipped - Slack not enabled");
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`Slack API returned ${response.status}`);
    }

    logger.info("Slack notification sent successfully");
  } catch (error) {
    logger.error("Failed to send Slack notification", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

/**
 * Send webhook notification
 */
export async function sendWebhook(
  url: string,
  payload: any,
  options?: {
    method?: "POST" | "PUT";
    headers?: Record<string, string>;
  }
): Promise<void> {
  try {
    const response = await fetch(url, {
      method: options?.method || "POST",
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}`);
    }

    logger.info("Webhook sent successfully", { url });
  } catch (error) {
    logger.error("Failed to send webhook", {
      error: error instanceof Error ? error.message : "Unknown error",
      url,
    });
    throw error;
  }
}
