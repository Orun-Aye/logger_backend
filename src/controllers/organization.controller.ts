import { Request, Response } from "express";
import {
  OrganizationService,
  OrgNotFoundError,
  OrgValidationError,
  OrgForbiddenError,
} from "../services/organization.service";
import {
  TeamService,
  TeamNotFoundError,
  TeamValidationError,
} from "../services/team.service";
import {
  AuditLogService,
  AuditLogValidationError,
} from "../services/auditLog.service";

interface ApiResponse<T = any> {
  status: "success" | "error";
  message?: string;
  data?: T;
  errors?: string[];
  meta?: any;
}

export class OrganizationController {
  // ──────────────────────────────────────────────
  // Centralized error handler
  // ──────────────────────────────────────────────

  private static handleError(
    error: Error,
    res: Response,
    defaultMessage: string
  ): Response {
    console.error(`OrganizationController Error: ${error.message}`, error.stack);

    if (
      error instanceof OrgValidationError ||
      error instanceof TeamValidationError ||
      error instanceof AuditLogValidationError
    ) {
      return res.status(400).json({
        status: "error",
        message: error.message,
      } as ApiResponse);
    }

    if (
      error instanceof OrgNotFoundError ||
      error instanceof TeamNotFoundError
    ) {
      return res.status(404).json({
        status: "error",
        message: error.message,
      } as ApiResponse);
    }

    if (error instanceof OrgForbiddenError) {
      return res.status(403).json({
        status: "error",
        message: error.message,
      } as ApiResponse);
    }

    return res.status(500).json({
      status: "error",
      message: defaultMessage,
    } as ApiResponse);
  }

  // ──────────────────────────────────────────────
  // Organization CRUD
  // ──────────────────────────────────────────────

  static async createOrganization(req: Request, res: Response): Promise<Response> {
    try {
      const { name, slug, billingEmail } = req.body;
      if (!name || !slug) {
        return res.status(400).json({
          status: "error",
          message: "Name and slug are required",
        } as ApiResponse);
      }

      const org = await OrganizationService.createOrganization(
        name,
        slug,
        req.userId!
      );

      // If billingEmail was provided, update it
      if (billingEmail) {
        await OrganizationService.updateOrganization(org._id.toString(), {
          billingEmail,
        });
      }

      return res.status(201).json({
        status: "success",
        message: "Organization created successfully",
        data: org,
      } as ApiResponse);
    } catch (error) {
      return OrganizationController.handleError(
        error as Error,
        res,
        "Failed to create organization"
      );
    }
  }

  static async listOrganizations(req: Request, res: Response): Promise<Response> {
    try {
      const orgs = await OrganizationService.getUserOrganizations(req.userId!);

      return res.status(200).json({
        status: "success",
        data: orgs,
      } as ApiResponse);
    } catch (error) {
      return OrganizationController.handleError(
        error as Error,
        res,
        "Failed to list organizations"
      );
    }
  }

  static async getOrganization(req: Request, res: Response): Promise<Response> {
    try {
      const org = await OrganizationService.getOrganization(req.params.orgId);

      return res.status(200).json({
        status: "success",
        data: org,
      } as ApiResponse);
    } catch (error) {
      return OrganizationController.handleError(
        error as Error,
        res,
        "Failed to get organization"
      );
    }
  }

  static async updateOrganization(req: Request, res: Response): Promise<Response> {
    try {
      const { name, billingEmail, settings, plan } = req.body;
      const org = await OrganizationService.updateOrganization(
        req.params.orgId,
        { name, billingEmail, settings, plan }
      );

      return res.status(200).json({
        status: "success",
        message: "Organization updated successfully",
        data: org,
      } as ApiResponse);
    } catch (error) {
      return OrganizationController.handleError(
        error as Error,
        res,
        "Failed to update organization"
      );
    }
  }

  static async deleteOrganization(req: Request, res: Response): Promise<Response> {
    try {
      await OrganizationService.deleteOrganization(
        req.params.orgId,
        req.userId!
      );

      return res.status(200).json({
        status: "success",
        message: "Organization deleted successfully",
      } as ApiResponse);
    } catch (error) {
      return OrganizationController.handleError(
        error as Error,
        res,
        "Failed to delete organization"
      );
    }
  }

  // ──────────────────────────────────────────────
  // Organization Members
  // ──────────────────────────────────────────────

  static async listMembers(req: Request, res: Response): Promise<Response> {
    try {
      const org = await OrganizationService.getOrganization(req.params.orgId);

      return res.status(200).json({
        status: "success",
        data: org.members,
      } as ApiResponse);
    } catch (error) {
      return OrganizationController.handleError(
        error as Error,
        res,
        "Failed to list members"
      );
    }
  }

  static async addMember(req: Request, res: Response): Promise<Response> {
    try {
      const { email, userId: targetUserId, role } = req.body;

      let org;
      if (email) {
        // Invite by email
        org = await OrganizationService.createInvite(
          req.params.orgId,
          email,
          role || "member"
        );
      } else if (targetUserId) {
        // Add directly by userId
        org = await OrganizationService.addMember(
          req.params.orgId,
          targetUserId,
          role || "member"
        );
      } else {
        return res.status(400).json({
          status: "error",
          message: "Either email or userId is required",
        } as ApiResponse);
      }

      return res.status(201).json({
        status: "success",
        message: email ? "Invite sent successfully" : "Member added successfully",
        data: org.members,
      } as ApiResponse);
    } catch (error) {
      return OrganizationController.handleError(
        error as Error,
        res,
        "Failed to add member"
      );
    }
  }

  static async removeMember(req: Request, res: Response): Promise<Response> {
    try {
      const org = await OrganizationService.removeMember(
        req.params.orgId,
        req.params.userId
      );

      return res.status(200).json({
        status: "success",
        message: "Member removed successfully",
        data: org.members,
      } as ApiResponse);
    } catch (error) {
      return OrganizationController.handleError(
        error as Error,
        res,
        "Failed to remove member"
      );
    }
  }

  static async updateMemberRole(req: Request, res: Response): Promise<Response> {
    try {
      const { role } = req.body;
      if (!role) {
        return res.status(400).json({
          status: "error",
          message: "Role is required",
        } as ApiResponse);
      }

      const org = await OrganizationService.updateMemberRole(
        req.params.orgId,
        req.params.userId,
        role
      );

      return res.status(200).json({
        status: "success",
        message: "Member role updated successfully",
        data: org.members,
      } as ApiResponse);
    } catch (error) {
      return OrganizationController.handleError(
        error as Error,
        res,
        "Failed to update member role"
      );
    }
  }

  static async acceptInvite(req: Request, res: Response): Promise<Response> {
    try {
      const org = await OrganizationService.acceptInvite(
        req.params.orgId,
        req.userId!
      );

      return res.status(200).json({
        status: "success",
        message: "Invite accepted successfully",
        data: org,
      } as ApiResponse);
    } catch (error) {
      return OrganizationController.handleError(
        error as Error,
        res,
        "Failed to accept invite"
      );
    }
  }

  // ──────────────────────────────────────────────
  // Teams
  // ──────────────────────────────────────────────

  static async createTeam(req: Request, res: Response): Promise<Response> {
    try {
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({
          status: "error",
          message: "Team name is required",
        } as ApiResponse);
      }

      const team = await TeamService.createTeam(req.params.orgId, name);

      return res.status(201).json({
        status: "success",
        message: "Team created successfully",
        data: team,
      } as ApiResponse);
    } catch (error) {
      return OrganizationController.handleError(
        error as Error,
        res,
        "Failed to create team"
      );
    }
  }

  static async listTeams(req: Request, res: Response): Promise<Response> {
    try {
      const teams = await TeamService.getTeams(req.params.orgId);

      return res.status(200).json({
        status: "success",
        data: teams,
      } as ApiResponse);
    } catch (error) {
      return OrganizationController.handleError(
        error as Error,
        res,
        "Failed to list teams"
      );
    }
  }

  static async getTeam(req: Request, res: Response): Promise<Response> {
    try {
      const team = await TeamService.getTeam(req.params.teamId);

      // Verify the team belongs to this org
      if (team.organizationId.toString() !== req.params.orgId) {
        return res.status(404).json({
          status: "error",
          message: "Team not found in this organization",
        } as ApiResponse);
      }

      return res.status(200).json({
        status: "success",
        data: team,
      } as ApiResponse);
    } catch (error) {
      return OrganizationController.handleError(
        error as Error,
        res,
        "Failed to get team"
      );
    }
  }

  static async updateTeam(req: Request, res: Response): Promise<Response> {
    try {
      const { name } = req.body;

      // Verify team belongs to this org first
      const existingTeam = await TeamService.getTeam(req.params.teamId);
      if (existingTeam.organizationId.toString() !== req.params.orgId) {
        return res.status(404).json({
          status: "error",
          message: "Team not found in this organization",
        } as ApiResponse);
      }

      const team = await TeamService.updateTeam(req.params.teamId, { name });

      return res.status(200).json({
        status: "success",
        message: "Team updated successfully",
        data: team,
      } as ApiResponse);
    } catch (error) {
      return OrganizationController.handleError(
        error as Error,
        res,
        "Failed to update team"
      );
    }
  }

  static async deleteTeam(req: Request, res: Response): Promise<Response> {
    try {
      // Verify team belongs to this org first
      const existingTeam = await TeamService.getTeam(req.params.teamId);
      if (existingTeam.organizationId.toString() !== req.params.orgId) {
        return res.status(404).json({
          status: "error",
          message: "Team not found in this organization",
        } as ApiResponse);
      }

      await TeamService.deleteTeam(req.params.teamId);

      return res.status(200).json({
        status: "success",
        message: "Team deleted successfully",
      } as ApiResponse);
    } catch (error) {
      return OrganizationController.handleError(
        error as Error,
        res,
        "Failed to delete team"
      );
    }
  }

  static async addTeamMember(req: Request, res: Response): Promise<Response> {
    try {
      const { userId: targetUserId, role } = req.body;
      if (!targetUserId) {
        return res.status(400).json({
          status: "error",
          message: "userId is required",
        } as ApiResponse);
      }

      // Verify team belongs to this org
      const existingTeam = await TeamService.getTeam(req.params.teamId);
      if (existingTeam.organizationId.toString() !== req.params.orgId) {
        return res.status(404).json({
          status: "error",
          message: "Team not found in this organization",
        } as ApiResponse);
      }

      const team = await TeamService.addMember(
        req.params.teamId,
        targetUserId,
        role || "member"
      );

      return res.status(201).json({
        status: "success",
        message: "Team member added successfully",
        data: team,
      } as ApiResponse);
    } catch (error) {
      return OrganizationController.handleError(
        error as Error,
        res,
        "Failed to add team member"
      );
    }
  }

  static async removeTeamMember(req: Request, res: Response): Promise<Response> {
    try {
      // Verify team belongs to this org
      const existingTeam = await TeamService.getTeam(req.params.teamId);
      if (existingTeam.organizationId.toString() !== req.params.orgId) {
        return res.status(404).json({
          status: "error",
          message: "Team not found in this organization",
        } as ApiResponse);
      }

      const team = await TeamService.removeMember(
        req.params.teamId,
        req.params.userId
      );

      return res.status(200).json({
        status: "success",
        message: "Team member removed successfully",
        data: team,
      } as ApiResponse);
    } catch (error) {
      return OrganizationController.handleError(
        error as Error,
        res,
        "Failed to remove team member"
      );
    }
  }

  static async setProjectAccess(req: Request, res: Response): Promise<Response> {
    try {
      const { projectId, permission } = req.body;
      if (!projectId || !permission) {
        return res.status(400).json({
          status: "error",
          message: "projectId and permission are required",
        } as ApiResponse);
      }

      // Verify team belongs to this org
      const existingTeam = await TeamService.getTeam(req.params.teamId);
      if (existingTeam.organizationId.toString() !== req.params.orgId) {
        return res.status(404).json({
          status: "error",
          message: "Team not found in this organization",
        } as ApiResponse);
      }

      const team = await TeamService.setProjectAccess(
        req.params.teamId,
        projectId,
        permission
      );

      return res.status(200).json({
        status: "success",
        message: "Project access updated successfully",
        data: team,
      } as ApiResponse);
    } catch (error) {
      return OrganizationController.handleError(
        error as Error,
        res,
        "Failed to set project access"
      );
    }
  }

  // ──────────────────────────────────────────────
  // Audit Log
  // ──────────────────────────────────────────────

  static async queryAuditLog(req: Request, res: Response): Promise<Response> {
    try {
      const { action, resource, userId, startDate, endDate, page, limit } =
        req.query;

      const result = await AuditLogService.query(req.params.orgId, {
        action: action as string,
        resource: resource as string,
        userId: userId as string,
        startDate: startDate as string,
        endDate: endDate as string,
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });

      return res.status(200).json({
        status: "success",
        data: result.data,
        meta: result.pagination,
      } as ApiResponse);
    } catch (error) {
      return OrganizationController.handleError(
        error as Error,
        res,
        "Failed to query audit log"
      );
    }
  }

  static async exportAuditLog(req: Request, res: Response): Promise<Response> {
    try {
      const { action, resource, userId, startDate, endDate, format } = req.body;

      const result = await AuditLogService.exportAuditLog(
        req.params.orgId,
        {
          action,
          resource,
          userId,
          startDate,
          endDate,
        },
        format || "json"
      );

      res.setHeader("Content-Type", result.contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${result.filename}"`
      );

      return res.status(200).send(result.data);
    } catch (error) {
      return OrganizationController.handleError(
        error as Error,
        res,
        "Failed to export audit log"
      );
    }
  }
}
