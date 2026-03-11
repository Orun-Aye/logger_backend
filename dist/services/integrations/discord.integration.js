"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscordIntegration = void 0;
const base_integration_1 = require("./base.integration");
class DiscordIntegration extends base_integration_1.BaseIntegration {
    type = "discord";
    displayName = "Discord";
    description = "Send alert notifications and error reports to your Discord channels via webhooks.";
    category = "communication";
    requiredFields = ["webhookUrl"];
    optionalFields = [];
    supportedActions = ["send_notification"];
    async connect(config) {
        return this.test(config);
    }
    async disconnect() {
        // No persistent connection to clean up
    }
    async test(config) {
        const { webhookUrl } = config;
        if (!webhookUrl) {
            return { success: false, message: "Webhook URL is required" };
        }
        if (!webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
            return {
                success: false,
                message: "Invalid Discord webhook URL. Must start with https://discord.com/api/webhooks/",
            };
        }
        try {
            const response = await this.fetchWithTimeout(webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    embeds: [
                        {
                            title: "Apperio Integration Test",
                            description: "This is a test message from Apperio. Your Discord integration is working correctly.",
                            color: 0x00d97e,
                            footer: { text: "Apperio Observability Platform" },
                            timestamp: new Date().toISOString(),
                        },
                    ],
                }),
            });
            if (!response.ok) {
                const errorBody = await response.text();
                return {
                    success: false,
                    message: `Discord webhook returned ${response.status}: ${errorBody}`,
                };
            }
            return {
                success: true,
                message: "Successfully connected to Discord. Test message sent.",
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to connect to Discord: ${error.message}`,
            };
        }
    }
    async handleAction(action, payload, config) {
        switch (action) {
            case "send_notification":
                return this.sendNotification(payload, config);
            default:
                return {
                    success: false,
                    message: `Unsupported action: ${action}. Supported: ${this.supportedActions.join(", ")}`,
                };
        }
    }
    async sendNotification(payload, config) {
        const { webhookUrl } = config;
        const { title, description, level, project, url, fields } = payload;
        if (!webhookUrl) {
            return { success: false, message: "Webhook URL is required" };
        }
        const colorMap = {
            error: 0xef4444,
            fatal: 0xc0392b,
            warn: 0xf59e0b,
            info: 0x4d8ef8,
            debug: 0x6b7280,
            trace: 0x9ca3af,
        };
        const embed = {
            title: title || "Apperio Alert",
            description: description || "",
            color: colorMap[level || "info"] || 0x4d8ef8,
            footer: { text: "Apperio Observability Platform" },
            timestamp: new Date().toISOString(),
        };
        if (project) {
            embed.author = { name: `Project: ${project}` };
        }
        if (url) {
            embed.url = url;
        }
        if (fields && Array.isArray(fields)) {
            embed.fields = fields.map((f) => ({
                name: f.name || "",
                value: f.value || "",
                inline: f.inline !== false,
            }));
        }
        try {
            const response = await this.fetchWithTimeout(webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ embeds: [embed] }),
            });
            if (!response.ok) {
                const errorBody = await response.text();
                return {
                    success: false,
                    message: `Discord webhook failed: ${response.status} ${errorBody}`,
                };
            }
            return {
                success: true,
                message: "Notification sent to Discord successfully",
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to send Discord notification: ${error.message}`,
            };
        }
    }
}
exports.DiscordIntegration = DiscordIntegration;
