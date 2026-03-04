"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomDashboardService = exports.DashboardServiceError = exports.DashboardNotFoundError = void 0;
const customDashboard_model_1 = require("../models/customDashboard.model");
const uuid_1 = require("uuid");
class DashboardNotFoundError extends Error {
    constructor() {
        super("Dashboard not found");
        this.name = "DashboardNotFoundError";
    }
}
exports.DashboardNotFoundError = DashboardNotFoundError;
class DashboardServiceError extends Error {
    constructor(message) {
        super(message);
        this.name = "DashboardServiceError";
    }
}
exports.DashboardServiceError = DashboardServiceError;
class CustomDashboardService {
    static async create(userId, data) {
        try {
            // Assign IDs to widgets
            const widgets = (data.widgets || []).map((w) => ({
                ...w,
                id: w.id || (0, uuid_1.v4)(),
            }));
            const dashboard = new customDashboard_model_1.CustomDashboardModel({
                userId,
                name: data.name,
                description: data.description,
                widgets,
                isDefault: data.isDefault || false,
                isShared: data.isShared || false,
                tags: data.tags || [],
            });
            return await dashboard.save();
        }
        catch (error) {
            throw new DashboardServiceError(`Failed to create dashboard: ${error}`);
        }
    }
    static async getByUser(userId) {
        try {
            return await customDashboard_model_1.CustomDashboardModel.find({
                $or: [{ userId }, { isShared: true }],
            }).sort({ isDefault: -1, updatedAt: -1 });
        }
        catch (error) {
            throw new DashboardServiceError(`Failed to get dashboards: ${error}`);
        }
    }
    static async getById(dashboardId, userId) {
        try {
            const dashboard = await customDashboard_model_1.CustomDashboardModel.findOne({
                _id: dashboardId,
                $or: [{ userId }, { isShared: true }],
            });
            if (!dashboard)
                throw new DashboardNotFoundError();
            return dashboard;
        }
        catch (error) {
            if (error instanceof DashboardNotFoundError)
                throw error;
            throw new DashboardServiceError(`Failed to get dashboard: ${error}`);
        }
    }
    static async update(dashboardId, userId, data) {
        try {
            const dashboard = await customDashboard_model_1.CustomDashboardModel.findOneAndUpdate({ _id: dashboardId, userId }, { $set: data }, { new: true, runValidators: true });
            if (!dashboard)
                throw new DashboardNotFoundError();
            return dashboard;
        }
        catch (error) {
            if (error instanceof DashboardNotFoundError)
                throw error;
            throw new DashboardServiceError(`Failed to update dashboard: ${error}`);
        }
    }
    static async delete(dashboardId, userId) {
        try {
            const result = await customDashboard_model_1.CustomDashboardModel.findOneAndDelete({ _id: dashboardId, userId });
            if (!result)
                throw new DashboardNotFoundError();
        }
        catch (error) {
            if (error instanceof DashboardNotFoundError)
                throw error;
            throw new DashboardServiceError(`Failed to delete dashboard: ${error}`);
        }
    }
    static async updateLayout(dashboardId, userId, widgets) {
        try {
            const processedWidgets = widgets.map((w) => ({
                ...w,
                id: w.id || (0, uuid_1.v4)(),
            }));
            const dashboard = await customDashboard_model_1.CustomDashboardModel.findOneAndUpdate({ _id: dashboardId, userId }, { $set: { widgets: processedWidgets } }, { new: true });
            if (!dashboard)
                throw new DashboardNotFoundError();
            return dashboard;
        }
        catch (error) {
            if (error instanceof DashboardNotFoundError)
                throw error;
            throw new DashboardServiceError(`Failed to update layout: ${error}`);
        }
    }
    static async addWidget(dashboardId, userId, widget) {
        try {
            const newWidget = { ...widget, id: widget.id || (0, uuid_1.v4)() };
            const dashboard = await customDashboard_model_1.CustomDashboardModel.findOneAndUpdate({ _id: dashboardId, userId }, { $push: { widgets: newWidget } }, { new: true });
            if (!dashboard)
                throw new DashboardNotFoundError();
            return dashboard;
        }
        catch (error) {
            if (error instanceof DashboardNotFoundError)
                throw error;
            throw new DashboardServiceError(`Failed to add widget: ${error}`);
        }
    }
    static async updateWidget(dashboardId, widgetId, userId, updates) {
        try {
            const updateFields = {};
            for (const [key, value] of Object.entries(updates)) {
                updateFields[`widgets.$.${key}`] = value;
            }
            const dashboard = await customDashboard_model_1.CustomDashboardModel.findOneAndUpdate({ _id: dashboardId, userId, "widgets.id": widgetId }, { $set: updateFields }, { new: true });
            if (!dashboard)
                throw new DashboardNotFoundError();
            return dashboard;
        }
        catch (error) {
            if (error instanceof DashboardNotFoundError)
                throw error;
            throw new DashboardServiceError(`Failed to update widget: ${error}`);
        }
    }
    static async removeWidget(dashboardId, widgetId, userId) {
        try {
            const dashboard = await customDashboard_model_1.CustomDashboardModel.findOneAndUpdate({ _id: dashboardId, userId }, { $pull: { widgets: { id: widgetId } } }, { new: true });
            if (!dashboard)
                throw new DashboardNotFoundError();
            return dashboard;
        }
        catch (error) {
            if (error instanceof DashboardNotFoundError)
                throw error;
            throw new DashboardServiceError(`Failed to remove widget: ${error}`);
        }
    }
    static async duplicate(dashboardId, userId, newName) {
        try {
            const original = await customDashboard_model_1.CustomDashboardModel.findOne({
                _id: dashboardId,
                $or: [{ userId }, { isShared: true }],
            });
            if (!original)
                throw new DashboardNotFoundError();
            const dashboard = new customDashboard_model_1.CustomDashboardModel({
                userId,
                name: newName || `${original.name} (Copy)`,
                description: original.description,
                widgets: original.widgets.map((w) => ({ ...w.toObject?.() || w, id: (0, uuid_1.v4)() })),
                isDefault: false,
                isShared: false,
                tags: [...original.tags],
            });
            return await dashboard.save();
        }
        catch (error) {
            if (error instanceof DashboardNotFoundError)
                throw error;
            throw new DashboardServiceError(`Failed to duplicate dashboard: ${error}`);
        }
    }
}
exports.CustomDashboardService = CustomDashboardService;
