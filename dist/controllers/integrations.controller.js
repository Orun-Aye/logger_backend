"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationsController = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const integration_manager_1 = require("../services/integrations/integration.manager");
class IntegrationsController {
    /**
     * GET /integrations/available
     * List all available integration types with setup info.
     */
    static async getAvailableIntegrations(req, res) {
        try {
            const integrations = integration_manager_1.integrationManager.getAvailableIntegrations();
            return res.status(200).json({
                status: "success",
                data: integrations,
            });
        }
        catch (error) {
            return res.status(500).json({
                status: "error",
                message: "Failed to fetch available integrations",
                details: error.message,
            });
        }
    }
    /**
     * GET /integrations/connected
     * List connected integrations for the authenticated user.
     * Query params: ?projectId=xxx
     */
    static async getConnectedIntegrations(req, res) {
        try {
            const userId = req.userId;
            if (!userId) {
                return res.status(401).json({
                    status: "error",
                    message: "Unauthorized",
                });
            }
            const { projectId } = req.query;
            if (projectId && !mongoose_1.default.Types.ObjectId.isValid(projectId)) {
                return res.status(400).json({
                    status: "error",
                    message: "Invalid project ID",
                });
            }
            const integrations = await integration_manager_1.integrationManager.getConnectedIntegrations(userId, projectId);
            return res.status(200).json({
                status: "success",
                data: integrations,
            });
        }
        catch (error) {
            return res.status(500).json({
                status: "error",
                message: "Failed to fetch connected integrations",
                details: error.message,
            });
        }
    }
    /**
     * GET /integrations/:id
     * Get a single integration by ID.
     */
    static async getIntegrationById(req, res) {
        try {
            const userId = req.userId;
            if (!userId) {
                return res.status(401).json({
                    status: "error",
                    message: "Unauthorized",
                });
            }
            const { id } = req.params;
            if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    status: "error",
                    message: "Invalid integration ID",
                });
            }
            const integration = await integration_manager_1.integrationManager.getIntegrationById(id, userId);
            if (!integration) {
                return res.status(404).json({
                    status: "error",
                    message: "Integration not found",
                });
            }
            return res.status(200).json({
                status: "success",
                data: integration,
            });
        }
        catch (error) {
            return res.status(500).json({
                status: "error",
                message: "Failed to fetch integration",
                details: error.message,
            });
        }
    }
    /**
     * GET /integrations/type/:type
     * Get integration type metadata by slug.
     */
    static async getIntegrationType(req, res) {
        try {
            const { type } = req.params;
            const info = integration_manager_1.integrationManager.getIntegrationTypeInfo(type);
            if (!info) {
                return res.status(404).json({
                    status: "error",
                    message: `Integration type "${type}" not found`,
                });
            }
            return res.status(200).json({
                status: "success",
                data: info,
            });
        }
        catch (error) {
            return res.status(500).json({
                status: "error",
                message: "Failed to fetch integration type info",
                details: error.message,
            });
        }
    }
    /**
     * POST /integrations/:type/connect
     * Connect a new integration.
     * Body: { config: {...}, projectId?: string, organizationId?: string }
     */
    static async connectIntegration(req, res) {
        try {
            const userId = req.userId;
            if (!userId) {
                return res.status(401).json({
                    status: "error",
                    message: "Unauthorized",
                });
            }
            const { type } = req.params;
            const { config, projectId, organizationId } = req.body;
            if (!config || typeof config !== "object") {
                return res.status(400).json({
                    status: "error",
                    message: "config object is required",
                });
            }
            if (projectId && !mongoose_1.default.Types.ObjectId.isValid(projectId)) {
                return res.status(400).json({
                    status: "error",
                    message: "Invalid project ID",
                });
            }
            const integration = await integration_manager_1.integrationManager.connectIntegration(userId, type, config, projectId, organizationId);
            return res.status(201).json({
                status: "success",
                message: `${type} integration connected successfully`,
                data: {
                    _id: integration._id,
                    type: integration.type,
                    status: integration.status,
                    projectId: integration.projectId,
                    metadata: integration.metadata,
                    createdAt: integration.createdAt,
                    updatedAt: integration.updatedAt,
                },
            });
        }
        catch (error) {
            const message = error.message;
            const statusCode = message.includes("not found") ||
                message.includes("Unknown integration")
                ? 400
                : message.includes("Connection failed")
                    ? 422
                    : 500;
            return res.status(statusCode).json({
                status: "error",
                message: `Failed to connect integration: ${message}`,
            });
        }
    }
    /**
     * POST /integrations/:id/test
     * Test an existing integration.
     */
    static async testIntegrationById(req, res) {
        try {
            const userId = req.userId;
            if (!userId) {
                return res.status(401).json({
                    status: "error",
                    message: "Unauthorized",
                });
            }
            const { id } = req.params;
            if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    status: "error",
                    message: "Invalid integration ID",
                });
            }
            const result = await integration_manager_1.integrationManager.testIntegration(id, userId);
            return res.status(result.success ? 200 : 422).json({
                status: result.success ? "success" : "error",
                message: result.message,
                data: { success: result.success },
            });
        }
        catch (error) {
            const message = error.message;
            const statusCode = message.includes("not found") ? 404 : 500;
            return res.status(statusCode).json({
                status: "error",
                message: `Failed to test integration: ${message}`,
            });
        }
    }
    /**
     * DELETE /integrations/:id
     * Disconnect (remove) an integration.
     */
    static async disconnectIntegration(req, res) {
        try {
            const userId = req.userId;
            if (!userId) {
                return res.status(401).json({
                    status: "error",
                    message: "Unauthorized",
                });
            }
            const { id } = req.params;
            if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    status: "error",
                    message: "Invalid integration ID",
                });
            }
            await integration_manager_1.integrationManager.disconnectIntegration(id, userId);
            return res.status(200).json({
                status: "success",
                message: "Integration disconnected successfully",
            });
        }
        catch (error) {
            const message = error.message;
            const statusCode = message.includes("not found") ? 404 : 500;
            return res.status(statusCode).json({
                status: "error",
                message: `Failed to disconnect integration: ${message}`,
            });
        }
    }
    /**
     * POST /integrations/:id/action
     * Execute an action on a connected integration.
     * Body: { action: string, payload: {...} }
     */
    static async executeAction(req, res) {
        try {
            const userId = req.userId;
            if (!userId) {
                return res.status(401).json({
                    status: "error",
                    message: "Unauthorized",
                });
            }
            const { id } = req.params;
            if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    status: "error",
                    message: "Invalid integration ID",
                });
            }
            const { action, payload } = req.body;
            if (!action || typeof action !== "string") {
                return res.status(400).json({
                    status: "error",
                    message: "action string is required",
                });
            }
            const result = await integration_manager_1.integrationManager.executeAction(id, userId, action, payload || {});
            return res.status(result.success ? 200 : 422).json({
                status: result.success ? "success" : "error",
                message: result.message,
                data: result.data,
            });
        }
        catch (error) {
            const message = error.message;
            const statusCode = message.includes("not found")
                ? 404
                : message.includes("not connected")
                    ? 409
                    : 500;
            return res.status(statusCode).json({
                status: "error",
                message: `Failed to execute action: ${message}`,
            });
        }
    }
}
exports.IntegrationsController = IntegrationsController;
