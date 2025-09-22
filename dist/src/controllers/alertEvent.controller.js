"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertEventController = void 0;
const alertEvent_model_1 = require("../models/alertEvent.model");
class AlertEventController {
    static async list(req, res) {
        try {
            const { projectId } = req.params;
            const page = Math.max(1, parseInt(req.query.page) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
            const skip = (page - 1) * limit;
            const severity = typeof req.query.severity === 'string' ? req.query.severity : undefined;
            const acknowledged = typeof req.query.acknowledged === 'string' ? req.query.acknowledged === 'true' : undefined;
            const query = { projectId };
            if (severity)
                query.severity = severity;
            if (acknowledged !== undefined)
                query.acknowledged = acknowledged;
            const [events, total] = await Promise.all([
                alertEvent_model_1.AlertEventModel.find(query).sort({ triggeredAt: -1 }).skip(skip).limit(limit).lean(),
                alertEvent_model_1.AlertEventModel.countDocuments(query),
            ]);
            res.status(200).json({
                status: 'success',
                data: events,
                meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
            });
        }
        catch (err) {
            res.status(500).json({ status: 'error', message: 'Failed to fetch alerts' });
        }
    }
    static async acknowledge(req, res) {
        try {
            const { alertId } = req.params;
            const updated = await alertEvent_model_1.AlertEventModel.findByIdAndUpdate(alertId, { acknowledged: true, acknowledgedAt: new Date() }, { new: true }).lean();
            if (!updated)
                return res.status(404).json({ status: 'error', message: 'Alert not found' });
            res.status(200).json({ status: 'success', data: updated });
        }
        catch (err) {
            res.status(500).json({ status: 'error', message: 'Failed to acknowledge alert' });
        }
    }
}
exports.AlertEventController = AlertEventController;
