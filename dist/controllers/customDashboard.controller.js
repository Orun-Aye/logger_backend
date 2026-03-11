"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomDashboardController = void 0;
const customDashboard_service_1 = require("../services/customDashboard.service");
class CustomDashboardController {
    static handleError(error, res) {
        if (error instanceof customDashboard_service_1.DashboardNotFoundError) {
            return res.status(404).json({ status: "error", message: error.message });
        }
        return res.status(500).json({ status: "error", message: error.message });
    }
    static async getByUser(req, res) {
        try {
            const data = await customDashboard_service_1.CustomDashboardService.getByUser(req.userId);
            return res.status(200).json({ status: "success", data });
        }
        catch (error) {
            return CustomDashboardController.handleError(error, res);
        }
    }
    static async create(req, res) {
        try {
            const data = await customDashboard_service_1.CustomDashboardService.create(req.userId, req.body);
            return res.status(201).json({ status: "success", message: "Dashboard created", data });
        }
        catch (error) {
            return CustomDashboardController.handleError(error, res);
        }
    }
    static async getById(req, res) {
        try {
            const data = await customDashboard_service_1.CustomDashboardService.getById(req.params.dashboardId, req.userId);
            return res.status(200).json({ status: "success", data });
        }
        catch (error) {
            return CustomDashboardController.handleError(error, res);
        }
    }
    static async update(req, res) {
        try {
            const data = await customDashboard_service_1.CustomDashboardService.update(req.params.dashboardId, req.userId, req.body);
            return res.status(200).json({ status: "success", message: "Dashboard updated", data });
        }
        catch (error) {
            return CustomDashboardController.handleError(error, res);
        }
    }
    static async delete(req, res) {
        try {
            await customDashboard_service_1.CustomDashboardService.delete(req.params.dashboardId, req.userId);
            return res.status(200).json({ status: "success", message: "Dashboard deleted" });
        }
        catch (error) {
            return CustomDashboardController.handleError(error, res);
        }
    }
    static async updateLayout(req, res) {
        try {
            const data = await customDashboard_service_1.CustomDashboardService.updateLayout(req.params.dashboardId, req.userId, req.body.widgets);
            return res.status(200).json({ status: "success", message: "Layout updated", data });
        }
        catch (error) {
            return CustomDashboardController.handleError(error, res);
        }
    }
    static async addWidget(req, res) {
        try {
            const data = await customDashboard_service_1.CustomDashboardService.addWidget(req.params.dashboardId, req.userId, req.body);
            return res.status(201).json({ status: "success", message: "Widget added", data });
        }
        catch (error) {
            return CustomDashboardController.handleError(error, res);
        }
    }
    static async updateWidget(req, res) {
        try {
            const data = await customDashboard_service_1.CustomDashboardService.updateWidget(req.params.dashboardId, req.params.widgetId, req.userId, req.body);
            return res.status(200).json({ status: "success", message: "Widget updated", data });
        }
        catch (error) {
            return CustomDashboardController.handleError(error, res);
        }
    }
    static async removeWidget(req, res) {
        try {
            const data = await customDashboard_service_1.CustomDashboardService.removeWidget(req.params.dashboardId, req.params.widgetId, req.userId);
            return res.status(200).json({ status: "success", message: "Widget removed", data });
        }
        catch (error) {
            return CustomDashboardController.handleError(error, res);
        }
    }
    static async duplicate(req, res) {
        try {
            const data = await customDashboard_service_1.CustomDashboardService.duplicate(req.params.dashboardId, req.userId, req.body.name);
            return res.status(201).json({ status: "success", message: "Dashboard duplicated", data });
        }
        catch (error) {
            return CustomDashboardController.handleError(error, res);
        }
    }
}
exports.CustomDashboardController = CustomDashboardController;
