"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertEventController = void 0;
const alert_service_1 = require("../services/alert.service");
const mongoose_1 = require("mongoose");
class AlertEventController {
    /**
     * Get alerts with filtering, sorting, and pagination
     * GET /api/v1/alerts/:projectId
     */
    static async getAlerts(req, res) {
        try {
            const { projectId } = req.params;
            const page = Math.max(1, parseInt(req.query.page) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
            const offset = (page - 1) * limit;
            const filters = {
                projectId,
                severity: req.query.severity,
                status: req.query.status,
                ruleId: req.query.ruleId,
                startDate: req.query.startDate,
                endDate: req.query.endDate,
                tags: req.query.tags ? req.query.tags.split(',') : undefined,
                limit,
                offset,
                userId: !projectId ? req.userId : undefined,
            };
            // Remove undefined values
            Object.keys(filters).forEach(key => {
                if (filters[key] === undefined) {
                    delete filters[key];
                }
            });
            const result = await alert_service_1.AlertService.getAlerts(filters);
            res.status(200).json({
                status: 'success',
                data: result.alerts,
                meta: {
                    page,
                    limit: result.limit,
                    total: result.total,
                    totalPages: Math.ceil(result.total / result.limit),
                    offset: result.offset,
                },
            });
        }
        catch (err) {
            console.error('Failed to fetch alerts:', err);
            res.status(500).json({
                status: 'error',
                message: 'Failed to fetch alerts',
                error: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
        }
    }
    /**
     * Get alert statistics for dashboard
     * GET /api/alerts/:projectId/stats
     */
    static async getAlertStats(req, res) {
        try {
            const { projectId } = req.params;
            if (projectId && !mongoose_1.Types.ObjectId.isValid(projectId)) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid project ID format'
                });
            }
            const stats = await alert_service_1.AlertService.getAlertStats({
                projectId: projectId || undefined,
                userId: !projectId ? req.userId : undefined,
            });
            res.status(200).json({
                status: 'success',
                data: stats,
            });
        }
        catch (err) {
            console.error('Failed to fetch alert stats:', err);
            res.status(500).json({
                status: 'error',
                message: 'Failed to fetch alert statistics',
                error: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
        }
    }
    /**
     * Update alert status (acknowledge, resolve, snooze)
     * PATCH /api/alerts/:alertId/status
     */
    static async updateAlertStatus(req, res) {
        try {
            const { alertId } = req.params;
            const { status } = req.body;
            const userId = req.userId; // Assuming user info is available on req
            if (!mongoose_1.Types.ObjectId.isValid(alertId)) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid alert ID format'
                });
            }
            if (!['acknowledged', 'resolved', 'snoozed'].includes(status)) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid status. Must be one of: acknowledged, resolved, snoozed'
                });
            }
            const updatedAlert = await alert_service_1.AlertService.updateAlertStatus(alertId, status, userId);
            if (!updatedAlert) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Alert not found'
                });
            }
            res.status(200).json({
                status: 'success',
                data: updatedAlert,
                message: `Alert ${status} successfully`
            });
        }
        catch (err) {
            console.error('Failed to update alert status:', err);
            res.status(500).json({
                status: 'error',
                message: 'Failed to update alert status',
                error: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
        }
    }
    /**
     * Bulk update multiple alerts
     * PATCH /api/alerts/bulk-update
     */
    static async bulkUpdateAlerts(req, res) {
        try {
            const { alertIds, status } = req.body;
            const userId = req.userId;
            if (!Array.isArray(alertIds) || alertIds.length === 0) {
                return res.status(400).json({
                    status: 'error',
                    message: 'alertIds must be a non-empty array'
                });
            }
            if (!['acknowledged', 'resolved', 'snoozed'].includes(status)) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid status. Must be one of: acknowledged, resolved, snoozed'
                });
            }
            // Validate all alert IDs
            const invalidIds = alertIds.filter(id => !mongoose_1.Types.ObjectId.isValid(id));
            if (invalidIds.length > 0) {
                return res.status(400).json({
                    status: 'error',
                    message: `Invalid alert ID format: ${invalidIds.join(', ')}`
                });
            }
            const result = await alert_service_1.AlertService.bulkUpdateAlerts(alertIds, status, userId);
            res.status(200).json({
                status: 'success',
                data: {
                    modifiedCount: result.modifiedCount,
                    matchedCount: result.matchedCount
                },
                message: `${result.modifiedCount} alerts ${status} successfully`
            });
        }
        catch (err) {
            console.error('Failed to bulk update alerts:', err);
            res.status(500).json({
                status: 'error',
                message: 'Failed to bulk update alerts',
                error: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
        }
    }
    /**
     * Delete alerts (with optional soft delete)
     * DELETE /api/alerts
     */
    static async deleteAlerts(req, res) {
        try {
            const { alertIds } = req.body;
            const softDelete = req.query.soft !== 'false';
            if (!Array.isArray(alertIds) || alertIds.length === 0) {
                return res.status(400).json({
                    status: 'error',
                    message: 'alertIds must be a non-empty array'
                });
            }
            // Validate all alert IDs
            const invalidIds = alertIds.filter(id => !mongoose_1.Types.ObjectId.isValid(id));
            if (invalidIds.length > 0) {
                return res.status(400).json({
                    status: 'error',
                    message: `Invalid alert ID format: ${invalidIds.join(', ')}`
                });
            }
            const result = await alert_service_1.AlertService.deleteAlerts(alertIds, softDelete);
            res.status(200).json({
                status: 'success',
                data: {
                    deletedCount: softDelete ? result.modifiedCount : result.deletedCount,
                    softDelete
                },
                message: `${softDelete ? result.modifiedCount : result.deletedCount} alerts ${softDelete ? 'soft deleted' : 'deleted'} successfully`
            });
        }
        catch (err) {
            console.error('Failed to delete alerts:', err);
            res.status(500).json({
                status: 'error',
                message: 'Failed to delete alerts',
                error: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
        }
    }
    /**
     * Get distinct values for filtering
     * GET/api/alerts/:projectId/distinct/:field
     */
    static async getDistinctValues(req, res) {
        try {
            const { projectId, field } = req.params;
            if (!mongoose_1.Types.ObjectId.isValid(projectId)) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid project ID format'
                });
            }
            const allowedFields = ['severity', 'status', 'tags', 'ruleId'];
            if (!allowedFields.includes(field)) {
                return res.status(400).json({
                    status: 'error',
                    message: `Invalid field. Must be one of: ${allowedFields.join(', ')}`
                });
            }
            const values = await alert_service_1.AlertService.getDistinctValues(projectId, field);
            res.status(200).json({
                status: 'success',
                data: { field, values },
            });
        }
        catch (err) {
            console.error('Failed to get distinct values:', err);
            res.status(500).json({
                status: 'error',
                message: 'Failed to get distinct values',
                error: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
        }
    }
    /**
     * Auto-resolve old alerts
     * POST /api/alerts/auto-resolve
     */
    static async autoResolveOldAlerts(req, res) {
        try {
            const { olderThanDays = 30 } = req.body;
            if (!Number.isInteger(olderThanDays) || olderThanDays <= 0) {
                return res.status(400).json({
                    status: 'error',
                    message: 'olderThanDays must be a positive integer'
                });
            }
            const result = await alert_service_1.AlertService.autoResolveOldAlerts(olderThanDays);
            res.status(200).json({
                status: 'success',
                data: {
                    modifiedCount: result.modifiedCount,
                    matchedCount: result.matchedCount,
                    olderThanDays
                },
                message: `${result.modifiedCount} old alerts auto-resolved successfully`
            });
        }
        catch (err) {
            console.error('Failed to auto-resolve old alerts:', err);
            res.status(500).json({
                status: 'error',
                message: 'Failed to auto-resolve old alerts',
                error: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
        }
    }
    /**
     * Acknowledge multiple alerts (legacy endpoint for compatibility)
     * POST /api/alerts/acknowledge
     */
    static async acknowledge(req, res) {
        try {
            const { alertId, alertIds } = req.body;
            const userId = req.userId;
            // Handle single alert ID (legacy)
            if (alertId && !alertIds) {
                const updatedAlert = await alert_service_1.AlertService.updateAlertStatus(alertId, 'acknowledged', userId);
                if (!updatedAlert) {
                    return res.status(404).json({
                        status: 'error',
                        message: 'Alert not found'
                    });
                }
                return res.status(200).json({
                    status: 'success',
                    data: updatedAlert,
                    message: 'Alert acknowledged successfully'
                });
            }
            // Handle multiple alert IDs
            if (alertIds && Array.isArray(alertIds)) {
                const result = await alert_service_1.AlertService.bulkUpdateAlerts(alertIds, 'acknowledged', userId);
                return res.status(200).json({
                    status: 'success',
                    data: {
                        modifiedCount: result.modifiedCount,
                        matchedCount: result.matchedCount
                    },
                    message: `${result.modifiedCount} alerts acknowledged successfully`
                });
            }
            res.status(400).json({
                status: 'error',
                message: 'Either alertId or alertIds array is required'
            });
        }
        catch (err) {
            console.error('Failed to acknowledge alert(s):', err);
            res.status(500).json({
                status: 'error',
                message: 'Failed to acknowledge alert(s)',
                error: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
        }
    }
}
exports.AlertEventController = AlertEventController;
