import { ISDKConfig, SDKConfigModel } from "../models/sdk-config.model";

export class SDKConfigService {
  static async getConfig(projectId: string): Promise<ISDKConfig | null> {
    return SDKConfigModel.findOne({ projectId }).lean();
  }

  static async upsertConfig(projectId: string, config: Partial<ISDKConfig>): Promise<ISDKConfig> {
    return SDKConfigModel.findOneAndUpdate(
      { projectId },
      { $set: config },
      { upsert: true, new: true }
    ).lean();
  }

  static async getOrCreateDefault(projectId: string): Promise<ISDKConfig> {
    let config = await this.getConfig(projectId);
    if (!config) {
      config = await this.upsertConfig(projectId, {});
    }
    return config;
  }
}
