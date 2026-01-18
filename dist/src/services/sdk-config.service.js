"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SDKConfigService = void 0;
const sdk_config_model_1 = require("../models/sdk-config.model");
class SDKConfigService {
    static async getConfig(projectId) {
        return sdk_config_model_1.SDKConfigModel.findOne({ projectId }).lean();
    }
    static async upsertConfig(projectId, config) {
        return sdk_config_model_1.SDKConfigModel.findOneAndUpdate({ projectId }, { $set: config }, { upsert: true, new: true }).lean();
    }
    static async getOrCreateDefault(projectId) {
        let config = await this.getConfig(projectId);
        if (!config) {
            config = await this.upsertConfig(projectId, {});
        }
        return config;
    }
}
exports.SDKConfigService = SDKConfigService;
