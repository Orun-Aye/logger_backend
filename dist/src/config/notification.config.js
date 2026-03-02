"use strict";
// src/config/notification.config.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEmailTransporter = getEmailTransporter;
exports.sendEmail = sendEmail;
exports.sendSlackNotification = sendSlackNotification;
exports.sendWebhook = sendWebhook;
const nodemailer_1 = __importDefault(require("nodemailer"));
const index_1 = require("./index");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Email transporter (lazy initialization)
 */
let emailTransporter = null;
/**
 * Get email transporter
 */
function getEmailTransporter() {
    if (!index_1.config.email.enabled) {
        throw new Error("Email is not enabled in configuration");
    }
    if (!emailTransporter) {
        emailTransporter = nodemailer_1.default.createTransport({
            host: index_1.config.email.host,
            port: index_1.config.email.port,
            secure: index_1.config.email.secure,
            auth: {
                user: index_1.config.email.user,
                pass: index_1.config.email.password,
            },
        });
        logger_1.default.info("Email transporter initialized", {
            host: index_1.config.email.host,
            port: index_1.config.email.port,
        });
    }
    return emailTransporter;
}
/**
 * Send email
 */
async function sendEmail(options) {
    if (!index_1.config.email.enabled) {
        logger_1.default.warn("Email sending skipped - email not enabled");
        return;
    }
    try {
        const transporter = getEmailTransporter();
        await transporter.sendMail({
            from: index_1.config.email.from,
            to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
            subject: options.subject,
            html: options.html,
            text: options.text,
        });
        logger_1.default.info("Email sent successfully", {
            to: options.to,
            subject: options.subject,
        });
    }
    catch (error) {
        logger_1.default.error("Failed to send email", {
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
async function sendSlackNotification(webhookUrl, message) {
    if (!index_1.config.slack.enabled) {
        logger_1.default.warn("Slack notification skipped - Slack not enabled");
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
        logger_1.default.info("Slack notification sent successfully");
    }
    catch (error) {
        logger_1.default.error("Failed to send Slack notification", {
            error: error instanceof Error ? error.message : "Unknown error",
        });
        throw error;
    }
}
/**
 * Send webhook notification
 */
async function sendWebhook(url, payload, options) {
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
        logger_1.default.info("Webhook sent successfully", { url });
    }
    catch (error) {
        logger_1.default.error("Failed to send webhook", {
            error: error instanceof Error ? error.message : "Unknown error",
            url,
        });
        throw error;
    }
}
