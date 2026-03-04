import { Request, Response } from "express";
import { EscalationPolicyModel } from "../models/escalationPolicy.model";
import { Types } from "mongoose";
import {
  CreateEscalationPolicyDTO,
  UpdateEscalationPolicyDTO,
} from "../dtos/alert.dto";

export class EscalationPolicyController {
  /**
   * Create escalation policy
   * POST /api/v1/escalation-policies
   */
  static async create(req: Request, res: Response) {
    try {
      const data: CreateEscalationPolicyDTO = req.body;

      // Validation
      if (!data.name || !data.projectId || !data.levels || data.levels.length === 0) {
        return res.status(400).json({
          status: "error",
          message: "Missing required fields: name, projectId, and levels are required",
        });
      }

      // Validate levels
      for (const level of data.levels) {
        if (
          !level.level ||
          level.delayMinutes === undefined ||
          !level.notifyChannels ||
          level.notifyChannels.length === 0 ||
          !level.recipients ||
          level.recipients.length === 0
        ) {
          return res.status(400).json({
            status: "error",
            message: "Each escalation level must have level, delayMinutes, notifyChannels, and recipients",
          });
        }
      }

      const policy = await EscalationPolicyModel.create({
        ...data,
        projectId: new Types.ObjectId(data.projectId as string),
        createdBy: req.userId ? new Types.ObjectId(req.userId) : undefined,
      });

      res.status(201).json({
        status: "success",
        data: policy,
      });
    } catch (err) {
      console.error("Create escalation policy error:", err);
      res.status(500).json({
        status: "error",
        message: "Failed to create escalation policy",
        details: (err as Error).message,
      });
    }
  }

  /**
   * Get escalation policies for a project
   * GET /api/v1/escalation-policies/project/:projectId
   */
  static async getByProject(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const isActive = req.query.isActive === "true";

      const query: any = {
        projectId: new Types.ObjectId(projectId),
      };

      if (isActive !== undefined) {
        query.isActive = isActive;
      }

      const policies = await EscalationPolicyModel.find(query)
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 })
        .lean();

      res.status(200).json({
        status: "success",
        data: policies,
      });
    } catch (err) {
      console.error("Get escalation policies error:", err);
      res.status(500).json({
        status: "error",
        message: "Failed to fetch escalation policies",
      });
    }
  }

  /**
   * Get escalation policy by ID
   * GET /api/v1/escalation-policies/:id
   */
  static async getById(req: Request, res: Response) {
    try {
      const policy = await EscalationPolicyModel.findById(req.params.id)
        .populate("createdBy", "name email")
        .lean();

      if (!policy) {
        return res.status(404).json({
          status: "error",
          message: "Escalation policy not found",
        });
      }

      res.status(200).json({
        status: "success",
        data: policy,
      });
    } catch (err) {
      console.error("Get escalation policy error:", err);
      res.status(500).json({
        status: "error",
        message: "Failed to fetch escalation policy",
      });
    }
  }

  /**
   * Update escalation policy
   * PUT /api/v1/escalation-policies/:id
   */
  static async update(req: Request, res: Response) {
    try {
      const data: UpdateEscalationPolicyDTO = req.body;

      const policy = await EscalationPolicyModel.findByIdAndUpdate(
        req.params.id,
        { $set: data },
        { new: true, runValidators: true }
      );

      if (!policy) {
        return res.status(404).json({
          status: "error",
          message: "Escalation policy not found",
        });
      }

      res.status(200).json({
        status: "success",
        data: policy,
      });
    } catch (err) {
      console.error("Update escalation policy error:", err);
      res.status(500).json({
        status: "error",
        message: "Failed to update escalation policy",
      });
    }
  }

  /**
   * Delete escalation policy (soft delete by setting isActive = false)
   * DELETE /api/v1/escalation-policies/:id
   */
  static async delete(req: Request, res: Response) {
    try {
      const hardDelete = req.query.hard === "true";

      if (hardDelete) {
        await EscalationPolicyModel.findByIdAndDelete(req.params.id);
      } else {
        await EscalationPolicyModel.findByIdAndUpdate(req.params.id, {
          $set: { isActive: false },
        });
      }

      res.status(204).send();
    } catch (err) {
      console.error("Delete escalation policy error:", err);
      res.status(500).json({
        status: "error",
        message: "Failed to delete escalation policy",
      });
    }
  }
}
