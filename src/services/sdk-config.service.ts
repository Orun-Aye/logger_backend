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

  static async getReplaySettings(projectId: string): Promise<ISDKConfig['replay']> {
    const config = await this.getOrCreateDefault(projectId);
    return {
      enabled: config.replay?.enabled ?? false,
      sampleRate: config.replay?.sampleRate ?? 0.1,
    };
  }

  static async updateReplaySettings(
    projectId: string,
    settings: Partial<ISDKConfig['replay']>
  ): Promise<ISDKConfig['replay']> {
    const $set: Record<string, unknown> = {};
    if (settings.enabled !== undefined) $set['replay.enabled'] = settings.enabled;
    if (settings.sampleRate !== undefined) $set['replay.sampleRate'] = settings.sampleRate;
    await SDKConfigModel.findOneAndUpdate(
      { projectId },
      { $set },
      { upsert: true, new: true, runValidators: true }
    );
    return this.getReplaySettings(projectId);
  }

  static async getOrCreateDefault(projectId: string): Promise<ISDKConfig> {
    let config = await this.getConfig(projectId);
    if (!config) {
      config = await this.upsertConfig(projectId, {});
    }
    return config;
  }
}
