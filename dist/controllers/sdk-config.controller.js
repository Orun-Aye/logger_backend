"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SDKConfigController = void 0;
const sdk_config_service_1 = require("../services/sdk-config.service");
class SDKConfigController {
    /**
     * Get SDK config by projectId param (JWT-authenticated, dashboard use)
     */
    static async getConfig(req, res) {
        try {
            const { projectId } = req.params;
            const config = await sdk_config_service_1.SDKConfigService.getConfig(projectId);
            return res.status(200).json(config);
        }
        catch (error) {
            return res.status(500).json({ error: 'Failed to fetch SDK config' });
        }
    }
    /**
     * Update SDK config by projectId param (JWT-authenticated, dashboard use)
     */
    static async updateConfig(req, res) {
        try {
            const { projectId } = req.params;
            const updates = req.body;
            const config = await sdk_config_service_1.SDKConfigService.upsertConfig(projectId, updates);
            return res.json(config);
        }
        catch (error) {
            return res.status(500).json({ error: 'Failed to update SDK config' });
        }
    }
    /**
     * Get SDK config via API key (SDK remote config use)
     * projectId is resolved from API key by authenticateApiKey middleware
     */
    static async getConfigByApiKey(req, res) {
        try {
            const projectId = req.projectId;
            if (!projectId) {
                return res.status(400).json({
                    status: "error",
                    message: "Project ID not resolved from API key",
                });
            }
            const config = await sdk_config_service_1.SDKConfigService.getOrCreateDefault(projectId);
            // Return only SDK-relevant fields (exclude internal metadata)
            return res.status(200).json({
                status: "success",
                data: {
                    minLogLevel: config.minLogLevel,
                    batchSize: config.batchSize,
                    flushIntervalMs: config.flushIntervalMs,
                    environment: config.environment,
                    serviceName: config.serviceName,
                    autoCapture: config.autoCapture,
                    sanitization: {
                        enabled: config.sanitization?.enabled,
                        strictMode: config.sanitization?.strictMode,
                    },
                },
            });
        }
        catch (error) {
            return res.status(500).json({
                status: "error",
                message: "Failed to fetch SDK config",
            });
        }
    }
}
exports.SDKConfigController = SDKConfigController;
