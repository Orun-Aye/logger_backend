import { CustomDashboardModel, ICustomDashboard } from "../models/customDashboard.model";
import { v4 as uuidv4 } from "uuid";

export class DashboardNotFoundError extends Error {
  constructor() {
    super("Dashboard not found");
    this.name = "DashboardNotFoundError";
  }
}

export class DashboardServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DashboardServiceError";
  }
}

export class CustomDashboardService {
  static async create(userId: string, data: any): Promise<ICustomDashboard> {
    try {
      // Assign IDs to widgets
      const widgets = (data.widgets || []).map((w: any) => ({
        ...w,
        id: w.id || uuidv4(),
      }));

      const dashboard = new CustomDashboardModel({
        userId,
        name: data.name,
        description: data.description,
        widgets,
        isDefault: data.isDefault || false,
        isShared: data.isShared || false,
        tags: data.tags || [],
      });

      return await dashboard.save();
    } catch (error) {
      throw new DashboardServiceError(`Failed to create dashboard: ${error}`);
    }
  }

  static async getByUser(userId: string): Promise<ICustomDashboard[]> {
    try {
      return await CustomDashboardModel.find({
        $or: [{ userId }, { isShared: true }],
      }).sort({ isDefault: -1, updatedAt: -1 });
    } catch (error) {
      throw new DashboardServiceError(`Failed to get dashboards: ${error}`);
    }
  }

  static async getById(dashboardId: string, userId: string): Promise<ICustomDashboard> {
    try {
      const dashboard = await CustomDashboardModel.findOne({
        _id: dashboardId,
        $or: [{ userId }, { isShared: true }],
      });
      if (!dashboard) throw new DashboardNotFoundError();
      return dashboard;
    } catch (error) {
      if (error instanceof DashboardNotFoundError) throw error;
      throw new DashboardServiceError(`Failed to get dashboard: ${error}`);
    }
  }

  static async update(dashboardId: string, userId: string, data: any): Promise<ICustomDashboard> {
    try {
      const dashboard = await CustomDashboardModel.findOneAndUpdate(
        { _id: dashboardId, userId },
        { $set: data },
        { new: true, runValidators: true }
      );
      if (!dashboard) throw new DashboardNotFoundError();
      return dashboard;
    } catch (error) {
      if (error instanceof DashboardNotFoundError) throw error;
      throw new DashboardServiceError(`Failed to update dashboard: ${error}`);
    }
  }

  static async delete(dashboardId: string, userId: string): Promise<void> {
    try {
      const result = await CustomDashboardModel.findOneAndDelete({ _id: dashboardId, userId });
      if (!result) throw new DashboardNotFoundError();
    } catch (error) {
      if (error instanceof DashboardNotFoundError) throw error;
      throw new DashboardServiceError(`Failed to delete dashboard: ${error}`);
    }
  }

  static async updateLayout(dashboardId: string, userId: string, widgets: any[]): Promise<ICustomDashboard> {
    try {
      const processedWidgets = widgets.map((w: any) => ({
        ...w,
        id: w.id || uuidv4(),
      }));

      const dashboard = await CustomDashboardModel.findOneAndUpdate(
        { _id: dashboardId, userId },
        { $set: { widgets: processedWidgets } },
        { new: true }
      );
      if (!dashboard) throw new DashboardNotFoundError();
      return dashboard;
    } catch (error) {
      if (error instanceof DashboardNotFoundError) throw error;
      throw new DashboardServiceError(`Failed to update layout: ${error}`);
    }
  }

  static async addWidget(dashboardId: string, userId: string, widget: any): Promise<ICustomDashboard> {
    try {
      const newWidget = { ...widget, id: widget.id || uuidv4() };
      const dashboard = await CustomDashboardModel.findOneAndUpdate(
        { _id: dashboardId, userId },
        { $push: { widgets: newWidget } },
        { new: true }
      );
      if (!dashboard) throw new DashboardNotFoundError();
      return dashboard;
    } catch (error) {
      if (error instanceof DashboardNotFoundError) throw error;
      throw new DashboardServiceError(`Failed to add widget: ${error}`);
    }
  }

  static async updateWidget(dashboardId: string, widgetId: string, userId: string, updates: any): Promise<ICustomDashboard> {
    try {
      const updateFields: any = {};
      for (const [key, value] of Object.entries(updates)) {
        updateFields[`widgets.$.${key}`] = value;
      }

      const dashboard = await CustomDashboardModel.findOneAndUpdate(
        { _id: dashboardId, userId, "widgets.id": widgetId },
        { $set: updateFields },
        { new: true }
      );
      if (!dashboard) throw new DashboardNotFoundError();
      return dashboard;
    } catch (error) {
      if (error instanceof DashboardNotFoundError) throw error;
      throw new DashboardServiceError(`Failed to update widget: ${error}`);
    }
  }

  static async removeWidget(dashboardId: string, widgetId: string, userId: string): Promise<ICustomDashboard> {
    try {
      const dashboard = await CustomDashboardModel.findOneAndUpdate(
        { _id: dashboardId, userId },
        { $pull: { widgets: { id: widgetId } } },
        { new: true }
      );
      if (!dashboard) throw new DashboardNotFoundError();
      return dashboard;
    } catch (error) {
      if (error instanceof DashboardNotFoundError) throw error;
      throw new DashboardServiceError(`Failed to remove widget: ${error}`);
    }
  }

  static async duplicate(dashboardId: string, userId: string, newName?: string): Promise<ICustomDashboard> {
    try {
      const original = await CustomDashboardModel.findOne({
        _id: dashboardId,
        $or: [{ userId }, { isShared: true }],
      });
      if (!original) throw new DashboardNotFoundError();

      const dashboard = new CustomDashboardModel({
        userId,
        name: newName || `${original.name} (Copy)`,
        description: original.description,
        widgets: original.widgets.map((w: any) => ({ ...w.toObject?.() || w, id: uuidv4() })),
        isDefault: false,
        isShared: false,
        tags: [...original.tags],
      });

      return await dashboard.save();
    } catch (error) {
      if (error instanceof DashboardNotFoundError) throw error;
      throw new DashboardServiceError(`Failed to duplicate dashboard: ${error}`);
    }
  }
}
