// @ts-nocheck
import { Request, Response } from "express";
import { AlertEventModel } from "../models/alertEvent.model";

export class AlertEventController {
  static async list(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const skip = (page - 1) * limit;
      const severity = typeof req.query.severity === 'string' ? req.query.severity : undefined;
      const acknowledged = typeof req.query.acknowledged === 'string' ? req.query.acknowledged === 'true' : undefined;

      const query: any = { projectId };
      if (severity) query.severity = severity;
      if (acknowledged !== undefined) query.acknowledged = acknowledged;

      const [events, total] = await Promise.all([
        AlertEventModel.find(query).sort({ triggeredAt: -1 }).skip(skip).limit(limit).lean(),
        AlertEventModel.countDocuments(query),
      ]);

      res.status(200).json({
        status: 'success',
        data: events,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      res.status(500).json({ status: 'error', message: 'Failed to fetch alerts' });
    }
  }

  static async acknowledge(req: Request, res: Response) {
    try {
      const { alertId } = req.params;
      const updated = await AlertEventModel.findByIdAndUpdate(
        alertId,
        { acknowledged: true, acknowledgedAt: new Date() },
        { new: true }
      ).lean();
      if (!updated) return res.status(404).json({ status: 'error', message: 'Alert not found' });
      res.status(200).json({ status: 'success', data: updated });
    } catch (err) {
      res.status(500).json({ status: 'error', message: 'Failed to acknowledge alert' });
    }
  }
}


