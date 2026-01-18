"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SDKConfigController = void 0;
const sdk_config_service_1 = require("../services/sdk-config.service");
class SDKConfigController {
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
}
exports.SDKConfigController = SDKConfigController;
