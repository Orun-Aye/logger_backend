"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MicrosoftTeamsIntegration = void 0;
const base_integration_1 = require("./base.integration");
class MicrosoftTeamsIntegration extends base_integration_1.BaseIntegration {
    type = "teams";
    displayName = "Microsoft Teams";
    description = "Send alert notifications and incident reports to Microsoft Teams channels via incoming webhooks.";
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
        try {
            // Send a test adaptive card
            const card = this.buildAdaptiveCard({
                title: "Apperio Integration Test",
                description: "This is a test message from Apperio. Your Microsoft Teams integration is working correctly.",
                level: "info",
                facts: [
                    { title: "Status", value: "Connected" },
                    { title: "Time", value: new Date().toISOString() },
                ],
            });
            const response = await this.fetchWithTimeout(webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(card),
            });
            if (!response.ok) {
                const errorBody = await response.text();
                return {
                    success: false,
                    message: `Teams webhook returned ${response.status}: ${errorBody}`,
                };
            }
            return {
                success: true,
                message: "Successfully connected to Microsoft Teams. Test message sent.",
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to connect to Microsoft Teams: ${error.message}`,
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
        const { title, description, level, project, facts } = payload;
        if (!webhookUrl) {
            return { success: false, message: "Webhook URL is required" };
        }
        const card = this.buildAdaptiveCard({
            title: title || "Apperio Alert",
            description: description || "",
            level: level || "info",
            project,
            facts,
        });
        try {
            const response = await this.fetchWithTimeout(webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(card),
            });
            if (!response.ok) {
                const errorBody = await response.text();
                return {
                    success: false,
                    message: `Teams webhook failed: ${response.status} ${errorBody}`,
                };
            }
            return {
                success: true,
                message: "Notification sent to Microsoft Teams successfully",
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to send Teams notification: ${error.message}`,
            };
        }
    }
    buildAdaptiveCard(params) {
        const colorMap = {
            error: "attention",
            fatal: "attention",
            warn: "warning",
            info: "accent",
            debug: "default",
            trace: "default",
        };
        const body = [
            {
                type: "TextBlock",
                text: params.title,
                weight: "bolder",
                size: "medium",
                color: colorMap[params.level || "info"] || "accent",
            },
        ];
        if (params.project) {
            body.push({
                type: "TextBlock",
                text: `Project: ${params.project}`,
                isSubtle: true,
                spacing: "none",
            });
        }
        if (params.description) {
            body.push({
                type: "TextBlock",
                text: params.description,
                wrap: true,
                spacing: "small",
            });
        }
        if (params.facts && params.facts.length > 0) {
            body.push({
                type: "FactSet",
                facts: params.facts.map((f) => ({
                    title: f.title,
                    value: f.value,
                })),
            });
        }
        body.push({
            type: "TextBlock",
            text: `Sent by Apperio at ${new Date().toISOString()}`,
            isSubtle: true,
            size: "small",
            spacing: "medium",
        });
        return {
            type: "message",
            attachments: [
                {
                    contentType: "application/vnd.microsoft.card.adaptive",
                    content: {
                        $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
                        type: "AdaptiveCard",
                        version: "1.4",
                        body,
                    },
                },
            ],
        };
    }
}
exports.MicrosoftTeamsIntegration = MicrosoftTeamsIntegration;
