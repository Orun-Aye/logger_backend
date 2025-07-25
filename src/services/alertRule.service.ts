import { AlertRuleModel } from "../models/alertRule.model";
import { AlertRuleDTO } from "../dtos/alertRule.dto";

export class AlertRuleService {
  static async create(projectId: string | undefined, dto: AlertRuleDTO) {
    return await AlertRuleModel.create({ projectId, ...dto });
  }

  static async list(projectId: string | undefined) {
    return await AlertRuleModel.find({ projectId });
  }

  static async update(ruleId: string, updates: Partial<AlertRuleDTO>) {
    return await AlertRuleModel.findByIdAndUpdate(ruleId, updates, { new: true });
  }

  static async delete(ruleId: string) {
    return await AlertRuleModel.findByIdAndDelete(ruleId);
  }

  static async evaluate(projectId: string | undefined, log: any) {
    const rules = await AlertRuleModel.find({ projectId, isActive: true });

    for (const rule of rules) {
      // Evaluate using separate utility (later)
    }
  }
}
