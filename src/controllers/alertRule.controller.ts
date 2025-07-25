// @ts-nocheck

import { Request, Response } from "express";
import { AlertRuleService } from "../services/alertRule.service";
import { AlertRuleDTO } from "../dtos/alertRule.dto";

export class AlertRuleController {
  static async create(req: Request, res: Response) {
    try {
      const rule = await AlertRuleService.create(req.projectId, req.body as AlertRuleDTO);
      res.status(201).json({ status: "success", data: rule });
    } catch (err) {
      res.status(500).json({ status: "error", message: "Failed to create alert rule." });
    }
  }

  static async list(req: Request, res: Response) {
    try {
      const rules = await AlertRuleService.list(req.projectId);
      res.status(200).json({ status: "success", data: rules });
    } catch (err) {
      res.status(500).json({ status: "error", message: "Failed to fetch rules." });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const updated = await AlertRuleService.update(req.params.id, req.body);
      res.status(200).json({ status: "success", data: updated });
    } catch (err) {
      res.status(500).json({ status: "error", message: "Update failed." });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      await AlertRuleService.delete(req.params.id);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ status: "error", message: "Delete failed." });
    }
  }
}
