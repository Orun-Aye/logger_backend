import { Request, Response } from "express";
import { MaintenanceWindowModel } from "../models/maintenanceWindow.model";
import { Types } from "mongoose";
import {
  CreateMaintenanceWindowDTO,
  UpdateMaintenanceWindowDTO,
} from "../dtos/alert.dto";

export class MaintenanceWindowController {
  /**
   * Create maintenance window
   * POST /api/v1/maintenance-windows
   */
  static async create(req: Request, res: Response) {
    try {
      const data: CreateMaintenanceWindowDTO = req.body;

      // Validation
      if (!data.name || !data.projectId || !data.startTime || !data.endTime) {
        return res.status(400).json({
          status: "error",
          message: "Missing required fields: name, projectId, startTime, and endTime are required",
        });
      }

      // Validate dates
      const start = new Date(data.startTime);
      const end = new Date(data.endTime);

      if (end <= start) {
        return res.status(400).json({
          status: "error",
          message: "endTime must be after startTime",
        });
      }

      const window = await MaintenanceWindowModel.create({
        ...data,
        projectId: new Types.ObjectId(data.projectId as string),
        startTime: start,
        endTime: end,
        createdBy: req.userId ? new Types.ObjectId(req.userId) : undefined,
      });

      res.status(201).json({
        status: "success",
        data: window,
      });
    } catch (err) {
      console.error("Create maintenance window error:", err);
      res.status(500).json({
        status: "error",
        message: "Failed to create maintenance window",
        details: (err as Error).message,
      });
    }
  }

  /**
   * Get maintenance windows for a project
   * GET /api/v1/maintenance-windows/project/:projectId
   */
  static async getByProject(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const isActive = req.query.isActive === "true";
      const includeExpired = req.query.includeExpired === "true";

      const query: any = {
        projectId: new Types.ObjectId(projectId),
      };

      if (isActive !== undefined) {
        query.isActive = isActive;
      }

      // Filter out expired windows unless explicitly included
      if (!includeExpired) {
        query.endTime = { $gte: new Date() };
      }

      const windows = await MaintenanceWindowModel.find(query)
        .populate("createdBy", "name email")
        .sort({ startTime: -1 })
        .lean();

      res.status(200).json({
        status: "success",
        data: windows,
      });
    } catch (err) {
      console.error("Get maintenance windows error:", err);
      res.status(500).json({
        status: "error",
        message: "Failed to fetch maintenance windows",
      });
    }
  }

  /**
   * Get currently active maintenance windows for a project
   * GET /api/v1/maintenance-windows/project/:projectId/active
   */
  static async getActiveByProject(req: Request, res: Response) {
    try {
      const { projectId } = req.params;

      const windows = await MaintenanceWindowModel.findActiveWindows(projectId);

      res.status(200).json({
        status: "success",
        data: windows,
        count: windows.length,
      });
    } catch (err) {
      console.error("Get active maintenance windows error:", err);
      res.status(500).json({
        status: "error",
        message: "Failed to fetch active maintenance windows",
      });
    }
  }

  /**
   * Get maintenance window by ID
   * GET /api/v1/maintenance-windows/:id
   */
  static async getById(req: Request, res: Response) {
    try {
      const window = await MaintenanceWindowModel.findById(req.params.id)
        .populate("createdBy", "name email")
        .lean();

      if (!window) {
        return res.status(404).json({
          status: "error",
          message: "Maintenance window not found",
        });
      }

      res.status(200).json({
        status: "success",
        data: window,
      });
    } catch (err) {
      console.error("Get maintenance window error:", err);
      res.status(500).json({
        status: "error",
        message: "Failed to fetch maintenance window",
      });
    }
  }

  /**
   * Update maintenance window
   * PUT /api/v1/maintenance-windows/:id
   */
  static async update(req: Request, res: Response) {
    try {
      const data: UpdateMaintenanceWindowDTO = req.body;

      // If dates are provided, validate them
      if (data.startTime && data.endTime) {
        const start = new Date(data.startTime);
        const end = new Date(data.endTime);
        if (end <= start) {
          return res.status(400).json({
            status: "error",
            message: "endTime must be after startTime",
          });
        }
        data.startTime = start;
        data.endTime = end;
      }

      const window = await MaintenanceWindowModel.findByIdAndUpdate(
        req.params.id,
        { $set: data },
        { new: true, runValidators: true }
      );

      if (!window) {
        return res.status(404).json({
          status: "error",
          message: "Maintenance window not found",
        });
      }

      res.status(200).json({
        status: "success",
        data: window,
      });
    } catch (err) {
      console.error("Update maintenance window error:", err);
      res.status(500).json({
        status: "error",
        message: "Failed to update maintenance window",
      });
    }
  }

  /**
   * Delete maintenance window (soft delete by setting isActive = false)
   * DELETE /api/v1/maintenance-windows/:id
   */
  static async delete(req: Request, res: Response) {
    try {
      const hardDelete = req.query.hard === "true";

      if (hardDelete) {
        await MaintenanceWindowModel.findByIdAndDelete(req.params.id);
      } else {
        await MaintenanceWindowModel.findByIdAndUpdate(req.params.id, {
          $set: { isActive: false },
        });
      }

      res.status(204).send();
    } catch (err) {
      console.error("Delete maintenance window error:", err);
      res.status(500).json({
        status: "error",
        message: "Failed to delete maintenance window",
      });
    }
  }

  /**
   * End maintenance window early
   * POST /api/v1/maintenance-windows/:id/end
   */
  static async endEarly(req: Request, res: Response) {
    try {
      const window = await MaintenanceWindowModel.findByIdAndUpdate(
        req.params.id,
        {
          $set: {
            endTime: new Date(),
            isActive: false,
          },
        },
        { new: true }
      );

      if (!window) {
        return res.status(404).json({
          status: "error",
          message: "Maintenance window not found",
        });
      }

      res.status(200).json({
        status: "success",
        data: window,
        message: "Maintenance window ended early",
      });
    } catch (err) {
      console.error("End maintenance window error:", err);
      res.status(500).json({
        status: "error",
        message: "Failed to end maintenance window",
      });
    }
  }
}
