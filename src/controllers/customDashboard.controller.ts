import { Request, Response } from "express";
import { CustomDashboardService, DashboardNotFoundError } from "../services/customDashboard.service";

export class CustomDashboardController {
  private static handleError(error: any, res: Response) {
    if (error instanceof DashboardNotFoundError) {
      return res.status(404).json({ status: "error", message: error.message });
    }
    return res.status(500).json({ status: "error", message: error.message });
  }

  static async getByUser(req: Request, res: Response) {
    try {
      const data = await CustomDashboardService.getByUser(req.userId!);
      return res.status(200).json({ status: "success", data });
    } catch (error: any) {
      return CustomDashboardController.handleError(error, res);
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const data = await CustomDashboardService.create(req.userId!, req.body);
      return res.status(201).json({ status: "success", message: "Dashboard created", data });
    } catch (error: any) {
      return CustomDashboardController.handleError(error, res);
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const data = await CustomDashboardService.getById(req.params.dashboardId, req.userId!);
      return res.status(200).json({ status: "success", data });
    } catch (error: any) {
      return CustomDashboardController.handleError(error, res);
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const data = await CustomDashboardService.update(req.params.dashboardId, req.userId!, req.body);
      return res.status(200).json({ status: "success", message: "Dashboard updated", data });
    } catch (error: any) {
      return CustomDashboardController.handleError(error, res);
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      await CustomDashboardService.delete(req.params.dashboardId, req.userId!);
      return res.status(200).json({ status: "success", message: "Dashboard deleted" });
    } catch (error: any) {
      return CustomDashboardController.handleError(error, res);
    }
  }

  static async updateLayout(req: Request, res: Response) {
    try {
      const data = await CustomDashboardService.updateLayout(req.params.dashboardId, req.userId!, req.body.widgets);
      return res.status(200).json({ status: "success", message: "Layout updated", data });
    } catch (error: any) {
      return CustomDashboardController.handleError(error, res);
    }
  }

  static async addWidget(req: Request, res: Response) {
    try {
      const data = await CustomDashboardService.addWidget(req.params.dashboardId, req.userId!, req.body);
      return res.status(201).json({ status: "success", message: "Widget added", data });
    } catch (error: any) {
      return CustomDashboardController.handleError(error, res);
    }
  }

  static async updateWidget(req: Request, res: Response) {
    try {
      const data = await CustomDashboardService.updateWidget(
        req.params.dashboardId,
        req.params.widgetId,
        req.userId!,
        req.body
      );
      return res.status(200).json({ status: "success", message: "Widget updated", data });
    } catch (error: any) {
      return CustomDashboardController.handleError(error, res);
    }
  }

  static async removeWidget(req: Request, res: Response) {
    try {
      const data = await CustomDashboardService.removeWidget(
        req.params.dashboardId,
        req.params.widgetId,
        req.userId!
      );
      return res.status(200).json({ status: "success", message: "Widget removed", data });
    } catch (error: any) {
      return CustomDashboardController.handleError(error, res);
    }
  }

  static async duplicate(req: Request, res: Response) {
    try {
      const data = await CustomDashboardService.duplicate(
        req.params.dashboardId,
        req.userId!,
        req.body.name
      );
      return res.status(201).json({ status: "success", message: "Dashboard duplicated", data });
    } catch (error: any) {
      return CustomDashboardController.handleError(error, res);
    }
  }
}
