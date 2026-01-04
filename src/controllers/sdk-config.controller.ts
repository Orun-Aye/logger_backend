import { SDKConfigService } from "../services/sdk-config.service";

export class SDKConfigController {
  static async getConfig(req: any, res: any) {
    try {
      const { projectId } = req.params;
      const config = await SDKConfigService.getOrCreateDefault(projectId);
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch SDK config' });
    }
  }

  static async updateConfig(req: any, res: any) {
    try {
      const { projectId } = req.params;
      const updates = req.body;
      const config = await SDKConfigService.upsertConfig(projectId, updates);
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update SDK config' });
    }
  }
}