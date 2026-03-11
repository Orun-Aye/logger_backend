"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationController = void 0;
const notification_service_1 = require("../services/notification.service");
const project_model_1 = require("../models/project.model");
const mongoose_1 = __importDefault(require("mongoose"));
class IntegrationController {
    /**
     * Test a specific integration configuration
     * POST /api/v1/integrations/:projectId/test
     *
     * Body: { type: 'slack' | 'email' | 'webhook', config: { webhookUrl?, recipients?, url?, headers? } }
     */
    static async testIntegration(req, res) {
        try {
            const { projectId } = req.params;
            const userId = req.userId;
            if (!userId) {
                return res.status(401).json({
                    status: "error",
                    message: "Unauthorized",
                });
            }
            // Validate projectId
            if (!mongoose_1.default.Types.ObjectId.isValid(projectId)) {
                return res.status(400).json({
                    status: "error",
                    message: "Invalid project ID",
                });
            }
            // Verify project exists and user has access
            const project = await project_model_1.ProjectModel.findById(projectId);
            if (!project) {
                return res.status(404).json({
                    status: "error",
                    message: "Project not found",
                });
            }
            const isOwner = project.ownerId?.toString() === userId;
            const isTeamAdmin = project.teamMembers.some((m) => m.user.toString() === userId && m.role === "admin");
            if (!isOwner && !isTeamAdmin) {
                return res.status(403).json({
                    status: "error",
                    message: "Only project owners and admins can test integrations",
                });
            }
            const { type, config: integrationConfig } = req.body;
            if (!type || !integrationConfig) {
                return res.status(400).json({
                    status: "error",
                    message: "type and config are required",
                });
            }
            let result;
            switch (type) {
                case "slack": {
                    const webhookUrl = integrationConfig.webhookUrl;
                    if (!webhookUrl) {
                        return res.status(400).json({
                            status: "error",
                            message: "webhookUrl is required for Slack integration test",
                        });
                    }
                    result = await notification_service_1.NotificationService.sendSlack(webhookUrl, {
                        text: "Apperio Test Notification",
                        attachments: [
                            {
                                color: "good",
                                title: "Integration Test",
                                text: `This is a test message from Apperio for project "${project.name}". If you see this, your Slack integration is working correctly.`,
                                fields: [
                                    { title: "Project", value: project.name, short: true },
                                    { title: "Status", value: "Connected", short: true },
                                ],
                                footer: "Apperio Integration Test",
                                ts: Math.floor(Date.now() / 1000),
                            },
                        ],
                    });
                    break;
                }
                case "email": {
                    const recipients = integrationConfig.recipients;
                    if (!recipients || recipients.length === 0) {
                        return res.status(400).json({
                            status: "error",
                            message: "At least one recipient is required for email integration test",
                        });
                    }
                    result = await notification_service_1.NotificationService.sendEmail({
                        to: recipients,
                        subject: `Apperio - Integration Test for "${project.name}"`,
                        html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #0b1220; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
                  <h1 style="color: #00d97e; margin: 0; font-size: 24px;">Apperio</h1>
                  <p style="color: #8b95a5; margin: 8px 0 0 0; font-size: 14px;">Integration Test</p>
                </div>
                <div style="background: #111c2e; padding: 24px; border-radius: 0 0 8px 8px; color: #e1e4e8;">
                  <p style="margin: 0 0 16px 0;">This is a test email from Apperio.</p>
                  <p style="margin: 0 0 16px 0;">If you received this email, your email integration for project <strong style="color: #00d97e;">${project.name}</strong> is working correctly.</p>
                  <div style="background: #0b1220; padding: 16px; border-radius: 6px; margin-top: 16px;">
                    <p style="margin: 0; font-size: 13px; color: #8b95a5;">
                      <strong>Project:</strong> ${project.name}<br/>
                      <strong>Time:</strong> ${new Date().toISOString()}<br/>
                      <strong>Status:</strong> <span style="color: #00d97e;">Connected</span>
                    </p>
                  </div>
                </div>
              </div>
            `,
                        text: `Apperio Integration Test\n\nThis is a test email for project "${project.name}". Your email integration is working correctly.\n\nTime: ${new Date().toISOString()}`,
                    });
                    break;
                }
                case "webhook": {
                    const url = integrationConfig.url;
                    if (!url) {
                        return res.status(400).json({
                            status: "error",
                            message: "url is required for webhook integration test",
                        });
                    }
                    result = await notification_service_1.NotificationService.sendWebhook({
                        url,
                        payload: {
                            type: "integration.test",
                            project: {
                                id: project._id.toString(),
                                name: project.name,
                            },
                            message: "This is a test webhook from Apperio. Your webhook integration is working correctly.",
                            timestamp: new Date().toISOString(),
                        },
                        headers: integrationConfig.headers || {},
                        timeout: 10000,
                        retries: 1,
                    });
                    break;
                }
                default:
                    return res.status(400).json({
                        status: "error",
                        message: `Unknown integration type: ${type}. Supported types: slack, email, webhook`,
                    });
            }
            if (result.success) {
                return res.status(200).json({
                    status: "success",
                    message: `${type} integration test successful`,
                    data: {
                        channel: result.channel,
                        duration: result.duration,
                    },
                });
            }
            else {
                return res.status(422).json({
                    status: "error",
                    message: `${type} integration test failed: ${result.error}`,
                    data: {
                        channel: result.channel,
                        statusCode: result.statusCode,
                        duration: result.duration,
                    },
                });
            }
        }
        catch (error) {
            console.error("Integration test error:", error);
            return res.status(500).json({
                status: "error",
                message: "Failed to test integration",
                details: error.message,
            });
        }
    }
}
exports.IntegrationController = IntegrationController;
