"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.integrationManager = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const integration_model_1 = require("../../models/integration.model");
const github_integration_1 = require("./github.integration");
const jira_integration_1 = require("./jira.integration");
const pagerduty_integration_1 = require("./pagerduty.integration");
const discord_integration_1 = require("./discord.integration");
const microsoft_teams_integration_1 = require("./microsoft-teams.integration");
const linear_integration_1 = require("./linear.integration");
class IntegrationManager {
    registry = new Map();
    constructor() {
        this.registerIntegration(new github_integration_1.GitHubIntegration());
        this.registerIntegration(new jira_integration_1.JiraIntegration());
        this.registerIntegration(new pagerduty_integration_1.PagerDutyIntegration());
        this.registerIntegration(new discord_integration_1.DiscordIntegration());
        this.registerIntegration(new microsoft_teams_integration_1.MicrosoftTeamsIntegration());
        this.registerIntegration(new linear_integration_1.LinearIntegration());
    }
    registerIntegration(integration) {
        this.registry.set(integration.type, integration);
    }
    /**
     * List all available integration types with setup info.
     */
    getAvailableIntegrations() {
        const integrations = [];
        this.registry.forEach((integration) => {
            integrations.push({
                type: integration.type,
                displayName: integration.displayName,
                description: integration.description,
                category: integration.category,
                requiredFields: integration.requiredFields,
                optionalFields: integration.optionalFields,
                supportedActions: integration.supportedActions,
            });
        });
        return integrations;
    }
    /**
     * Get all connected integrations for a user, optionally filtered by project.
     */
    async getConnectedIntegrations(userId, projectId) {
        const filter = { createdBy: userId };
        if (projectId) {
            filter.$or = [
                { projectId: new mongoose_1.default.Types.ObjectId(projectId) },
                { projectId: { $exists: false } },
                { projectId: null },
            ];
        }
        return integration_model_1.IntegrationModel.find(filter)
            .select("-config.accessToken -config.refreshToken")
            .sort({ updatedAt: -1 })
            .lean();
    }
    /**
     * Connect a new integration.
     */
    async connectIntegration(userId, type, config, projectId, organizationId) {
        const integration = this.registry.get(type);
        if (!integration) {
            throw new Error(`Unknown integration type: ${type}. Available: ${Array.from(this.registry.keys()).join(", ")}`);
        }
        // Validate required fields
        for (const field of integration.requiredFields) {
            if (!config[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }
        // Test connection before saving
        const testResult = await integration.connect(config);
        if (!testResult.success) {
            throw new Error(`Connection failed: ${testResult.message}`);
        }
        // Check if an integration of this type already exists for this user/project
        const existingFilter = {
            createdBy: userId,
            type,
        };
        if (projectId) {
            existingFilter.projectId = new mongoose_1.default.Types.ObjectId(projectId);
        }
        else {
            existingFilter.$or = [
                { projectId: { $exists: false } },
                { projectId: null },
            ];
        }
        const existing = await integration_model_1.IntegrationModel.findOne(existingFilter);
        if (existing) {
            // Update existing integration
            existing.config = config;
            existing.status = "connected";
            existing.metadata.lastSyncAt = new Date();
            existing.metadata.syncErrors = [];
            if (organizationId) {
                existing.organizationId = new mongoose_1.default.Types.ObjectId(organizationId);
            }
            await existing.save();
            return existing;
        }
        // Create new integration
        const newIntegration = new integration_model_1.IntegrationModel({
            type: type,
            status: "connected",
            config,
            metadata: {
                lastSyncAt: new Date(),
                syncErrors: [],
            },
            createdBy: new mongoose_1.default.Types.ObjectId(userId),
            ...(projectId && {
                projectId: new mongoose_1.default.Types.ObjectId(projectId),
            }),
            ...(organizationId && {
                organizationId: new mongoose_1.default.Types.ObjectId(organizationId),
            }),
        });
        await newIntegration.save();
        return newIntegration;
    }
    /**
     * Disconnect (remove) an integration.
     */
    async disconnectIntegration(integrationId, userId) {
        const doc = await integration_model_1.IntegrationModel.findOne({
            _id: integrationId,
            createdBy: userId,
        });
        if (!doc) {
            throw new Error("Integration not found or access denied");
        }
        const integration = this.registry.get(doc.type);
        if (integration) {
            await integration.disconnect();
        }
        await integration_model_1.IntegrationModel.deleteOne({ _id: integrationId });
    }
    /**
     * Test an existing integration's connection.
     */
    async testIntegration(integrationId, userId) {
        const doc = await integration_model_1.IntegrationModel.findOne({
            _id: integrationId,
            createdBy: userId,
        });
        if (!doc) {
            throw new Error("Integration not found or access denied");
        }
        const integration = this.registry.get(doc.type);
        if (!integration) {
            throw new Error(`Integration type "${doc.type}" not found in registry`);
        }
        const result = await integration.test(doc.config);
        // Update status based on test result
        doc.status = result.success ? "connected" : "error";
        doc.metadata.lastSyncAt = new Date();
        if (!result.success) {
            doc.metadata.syncErrors = [
                ...(doc.metadata.syncErrors || []).slice(-9),
                result.message,
            ];
        }
        else {
            doc.metadata.syncErrors = [];
        }
        await doc.save();
        return result;
    }
    /**
     * Execute an action on a connected integration.
     */
    async executeAction(integrationId, userId, action, payload) {
        const doc = await integration_model_1.IntegrationModel.findOne({
            _id: integrationId,
            createdBy: userId,
        });
        if (!doc) {
            throw new Error("Integration not found or access denied");
        }
        if (doc.status !== "connected") {
            throw new Error(`Integration is not connected (current status: ${doc.status})`);
        }
        const integration = this.registry.get(doc.type);
        if (!integration) {
            throw new Error(`Integration type "${doc.type}" not found in registry`);
        }
        const result = await integration.handleAction(action, payload, doc.config);
        // Update lastSyncAt
        doc.metadata.lastSyncAt = new Date();
        if (!result.success) {
            doc.metadata.syncErrors = [
                ...(doc.metadata.syncErrors || []).slice(-9),
                result.message || "Action failed",
            ];
        }
        await doc.save();
        return result;
    }
    /**
     * Execute an action for a project without requiring userId.
     * Used by server-side processes like alert notifications.
     */
    async executeActionForProject(projectId, integrationType, action, payload) {
        try {
            const doc = await integration_model_1.IntegrationModel.findOne({
                projectId: new mongoose_1.default.Types.ObjectId(projectId),
                type: integrationType,
                status: "connected",
            });
            if (!doc) {
                return {
                    success: false,
                    error: `No connected ${integrationType} integration found for project ${projectId}`,
                };
            }
            const handler = this.registry.get(doc.type);
            if (!handler) {
                return {
                    success: false,
                    error: `Integration type "${doc.type}" not found in registry`,
                };
            }
            const result = await handler.handleAction(action, payload, doc.config);
            // Update lastSyncAt
            doc.metadata.lastSyncAt = new Date();
            if (!result.success) {
                doc.metadata.syncErrors = [
                    ...(doc.metadata.syncErrors || []).slice(-9),
                    result.message || "Action failed",
                ];
            }
            await doc.save();
            return {
                success: result.success,
                result: result.data,
                error: result.success ? undefined : result.message,
            };
        }
        catch (error) {
            return {
                success: false,
                error: `executeActionForProject failed: ${error.message}`,
            };
        }
    }
    /**
     * Get a single integration by ID (for detail views).
     */
    async getIntegrationById(integrationId, userId) {
        return integration_model_1.IntegrationModel.findOne({
            _id: integrationId,
            createdBy: userId,
        })
            .select("-config.accessToken -config.refreshToken")
            .lean();
    }
    /**
     * Get integration type info by slug.
     */
    getIntegrationTypeInfo(type) {
        const integration = this.registry.get(type);
        if (!integration)
            return null;
        return {
            type: integration.type,
            displayName: integration.displayName,
            description: integration.description,
            category: integration.category,
            requiredFields: integration.requiredFields,
            optionalFields: integration.optionalFields,
            supportedActions: integration.supportedActions,
        };
    }
}
// Export singleton instance
exports.integrationManager = new IntegrationManager();
