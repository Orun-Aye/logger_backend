"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationController = void 0;
const organization_service_1 = require("../services/organization.service");
const team_service_1 = require("../services/team.service");
const auditLog_service_1 = require("../services/auditLog.service");
class OrganizationController {
    // ──────────────────────────────────────────────
    // Centralized error handler
    // ──────────────────────────────────────────────
    static handleError(error, res, defaultMessage) {
        console.error(`OrganizationController Error: ${error.message}`, error.stack);
        if (error instanceof organization_service_1.OrgValidationError ||
            error instanceof team_service_1.TeamValidationError ||
            error instanceof auditLog_service_1.AuditLogValidationError) {
            return res.status(400).json({
                status: "error",
                message: error.message,
            });
        }
        if (error instanceof organization_service_1.OrgNotFoundError ||
            error instanceof team_service_1.TeamNotFoundError) {
            return res.status(404).json({
                status: "error",
                message: error.message,
            });
        }
        if (error instanceof organization_service_1.OrgForbiddenError) {
            return res.status(403).json({
                status: "error",
                message: error.message,
            });
        }
        return res.status(500).json({
            status: "error",
            message: defaultMessage,
        });
    }
    // ──────────────────────────────────────────────
    // Organization CRUD
    // ──────────────────────────────────────────────
    static async createOrganization(req, res) {
        try {
            const { name, slug, billingEmail } = req.body;
            if (!name || !slug) {
                return res.status(400).json({
                    status: "error",
                    message: "Name and slug are required",
                });
            }
            const org = await organization_service_1.OrganizationService.createOrganization(name, slug, req.userId);
            // If billingEmail was provided, update it
            if (billingEmail) {
                await organization_service_1.OrganizationService.updateOrganization(org._id.toString(), {
                    billingEmail,
                });
            }
            return res.status(201).json({
                status: "success",
                message: "Organization created successfully",
                data: org,
            });
        }
        catch (error) {
            return OrganizationController.handleError(error, res, "Failed to create organization");
        }
    }
    static async listOrganizations(req, res) {
        try {
            const orgs = await organization_service_1.OrganizationService.getUserOrganizations(req.userId);
            return res.status(200).json({
                status: "success",
                data: orgs,
            });
        }
        catch (error) {
            return OrganizationController.handleError(error, res, "Failed to list organizations");
        }
    }
    static async getOrganization(req, res) {
        try {
            const org = await organization_service_1.OrganizationService.getOrganization(req.params.orgId);
            return res.status(200).json({
                status: "success",
                data: org,
            });
        }
        catch (error) {
            return OrganizationController.handleError(error, res, "Failed to get organization");
        }
    }
    static async updateOrganization(req, res) {
        try {
            const { name, billingEmail, settings, plan } = req.body;
            const org = await organization_service_1.OrganizationService.updateOrganization(req.params.orgId, { name, billingEmail, settings, plan });
            return res.status(200).json({
                status: "success",
                message: "Organization updated successfully",
                data: org,
            });
        }
        catch (error) {
            return OrganizationController.handleError(error, res, "Failed to update organization");
        }
    }
    static async deleteOrganization(req, res) {
        try {
            await organization_service_1.OrganizationService.deleteOrganization(req.params.orgId, req.userId);
            return res.status(200).json({
                status: "success",
                message: "Organization deleted successfully",
            });
        }
        catch (error) {
            return OrganizationController.handleError(error, res, "Failed to delete organization");
        }
    }
    // ──────────────────────────────────────────────
    // Organization Members
    // ──────────────────────────────────────────────
    static async listMembers(req, res) {
        try {
            const org = await organization_service_1.OrganizationService.getOrganization(req.params.orgId);
            return res.status(200).json({
                status: "success",
                data: org.members,
            });
        }
        catch (error) {
            return OrganizationController.handleError(error, res, "Failed to list members");
        }
    }
    static async addMember(req, res) {
        try {
            const { email, userId: targetUserId, role } = req.body;
            let org;
            if (email) {
                // Invite by email
                org = await organization_service_1.OrganizationService.createInvite(req.params.orgId, email, role || "member");
            }
            else if (targetUserId) {
                // Add directly by userId
                org = await organization_service_1.OrganizationService.addMember(req.params.orgId, targetUserId, role || "member");
            }
            else {
                return res.status(400).json({
                    status: "error",
                    message: "Either email or userId is required",
                });
            }
            return res.status(201).json({
                status: "success",
                message: email ? "Invite sent successfully" : "Member added successfully",
                data: org.members,
            });
        }
        catch (error) {
            return OrganizationController.handleError(error, res, "Failed to add member");
        }
    }
    static async removeMember(req, res) {
        try {
            const org = await organization_service_1.OrganizationService.removeMember(req.params.orgId, req.params.userId);
            return res.status(200).json({
                status: "success",
                message: "Member removed successfully",
                data: org.members,
            });
        }
        catch (error) {
            return OrganizationController.handleError(error, res, "Failed to remove member");
        }
    }
    static async updateMemberRole(req, res) {
        try {
            const { role } = req.body;
            if (!role) {
                return res.status(400).json({
                    status: "error",
                    message: "Role is required",
                });
            }
            const org = await organization_service_1.OrganizationService.updateMemberRole(req.params.orgId, req.params.userId, role);
            return res.status(200).json({
                status: "success",
                message: "Member role updated successfully",
                data: org.members,
            });
        }
        catch (error) {
            return OrganizationController.handleError(error, res, "Failed to update member role");
        }
    }
    static async acceptInvite(req, res) {
        try {
            const org = await organization_service_1.OrganizationService.acceptInvite(req.params.orgId, req.userId);
            return res.status(200).json({
                status: "success",
                message: "Invite accepted successfully",
                data: org,
            });
        }
        catch (error) {
            return OrganizationController.handleError(error, res, "Failed to accept invite");
        }
    }
    // ──────────────────────────────────────────────
    // Teams
    // ──────────────────────────────────────────────
    static async createTeam(req, res) {
        try {
            const { name } = req.body;
            if (!name) {
                return res.status(400).json({
                    status: "error",
                    message: "Team name is required",
                });
            }
            const team = await team_service_1.TeamService.createTeam(req.params.orgId, name);
            return res.status(201).json({
                status: "success",
                message: "Team created successfully",
                data: team,
            });
        }
        catch (error) {
            return OrganizationController.handleError(error, res, "Failed to create team");
        }
    }
    static async listTeams(req, res) {
        try {
            const teams = await team_service_1.TeamService.getTeams(req.params.orgId);
            return res.status(200).json({
                status: "success",
                data: teams,
            });
        }
        catch (error) {
            return OrganizationController.handleError(error, res, "Failed to list teams");
        }
    }
    static async getTeam(req, res) {
        try {
            const team = await team_service_1.TeamService.getTeam(req.params.teamId);
            // Verify the team belongs to this org
            if (team.organizationId.toString() !== req.params.orgId) {
                return res.status(404).json({
                    status: "error",
                    message: "Team not found in this organization",
                });
            }
            return res.status(200).json({
                status: "success",
                data: team,
            });
        }
        catch (error) {
            return OrganizationController.handleError(error, res, "Failed to get team");
        }
    }
    static async updateTeam(req, res) {
        try {
            const { name } = req.body;
            // Verify team belongs to this org first
            const existingTeam = await team_service_1.TeamService.getTeam(req.params.teamId);
            if (existingTeam.organizationId.toString() !== req.params.orgId) {
                return res.status(404).json({
                    status: "error",
                    message: "Team not found in this organization",
                });
            }
            const team = await team_service_1.TeamService.updateTeam(req.params.teamId, { name });
            return res.status(200).json({
                status: "success",
                message: "Team updated successfully",
                data: team,
            });
        }
        catch (error) {
            return OrganizationController.handleError(error, res, "Failed to update team");
        }
    }
    static async deleteTeam(req, res) {
        try {
            // Verify team belongs to this org first
            const existingTeam = await team_service_1.TeamService.getTeam(req.params.teamId);
            if (existingTeam.organizationId.toString() !== req.params.orgId) {
                return res.status(404).json({
                    status: "error",
                    message: "Team not found in this organization",
                });
            }
            await team_service_1.TeamService.deleteTeam(req.params.teamId);
            return res.status(200).json({
                status: "success",
                message: "Team deleted successfully",
            });
        }
        catch (error) {
            return OrganizationController.handleError(error, res, "Failed to delete team");
        }
    }
    static async addTeamMember(req, res) {
        try {
            const { userId: targetUserId, role } = req.body;
            if (!targetUserId) {
                return res.status(400).json({
                    status: "error",
                    message: "userId is required",
                });
            }
            // Verify team belongs to this org
            const existingTeam = await team_service_1.TeamService.getTeam(req.params.teamId);
            if (existingTeam.organizationId.toString() !== req.params.orgId) {
                return res.status(404).json({
                    status: "error",
                    message: "Team not found in this organization",
                });
            }
            const team = await team_service_1.TeamService.addMember(req.params.teamId, targetUserId, role || "member");
            return res.status(201).json({
                status: "success",
                message: "Team member added successfully",
                data: team,
            });
        }
        catch (error) {
            return OrganizationController.handleError(error, res, "Failed to add team member");
        }
    }
    static async removeTeamMember(req, res) {
        try {
            // Verify team belongs to this org
            const existingTeam = await team_service_1.TeamService.getTeam(req.params.teamId);
            if (existingTeam.organizationId.toString() !== req.params.orgId) {
                return res.status(404).json({
                    status: "error",
                    message: "Team not found in this organization",
                });
            }
            const team = await team_service_1.TeamService.removeMember(req.params.teamId, req.params.userId);
            return res.status(200).json({
                status: "success",
                message: "Team member removed successfully",
                data: team,
            });
        }
        catch (error) {
            return OrganizationController.handleError(error, res, "Failed to remove team member");
        }
    }
    static async setProjectAccess(req, res) {
        try {
            const { projectId, permission } = req.body;
            if (!projectId || !permission) {
                return res.status(400).json({
                    status: "error",
                    message: "projectId and permission are required",
                });
            }
            // Verify team belongs to this org
            const existingTeam = await team_service_1.TeamService.getTeam(req.params.teamId);
            if (existingTeam.organizationId.toString() !== req.params.orgId) {
                return res.status(404).json({
                    status: "error",
                    message: "Team not found in this organization",
                });
            }
            const team = await team_service_1.TeamService.setProjectAccess(req.params.teamId, projectId, permission);
            return res.status(200).json({
                status: "success",
                message: "Project access updated successfully",
                data: team,
            });
        }
        catch (error) {
            return OrganizationController.handleError(error, res, "Failed to set project access");
        }
    }
    // ──────────────────────────────────────────────
    // Audit Log
    // ──────────────────────────────────────────────
    static async queryAuditLog(req, res) {
        try {
            const { action, resource, userId, startDate, endDate, page, limit } = req.query;
            const result = await auditLog_service_1.AuditLogService.query(req.params.orgId, {
                action: action,
                resource: resource,
                userId: userId,
                startDate: startDate,
                endDate: endDate,
                page: page ? parseInt(page, 10) : undefined,
                limit: limit ? parseInt(limit, 10) : undefined,
            });
            return res.status(200).json({
                status: "success",
                data: result.data,
                meta: result.pagination,
            });
        }
        catch (error) {
            return OrganizationController.handleError(error, res, "Failed to query audit log");
        }
    }
    static async exportAuditLog(req, res) {
        try {
            const { action, resource, userId, startDate, endDate, format } = req.body;
            const result = await auditLog_service_1.AuditLogService.exportAuditLog(req.params.orgId, {
                action,
                resource,
                userId,
                startDate,
                endDate,
            }, format || "json");
            res.setHeader("Content-Type", result.contentType);
            res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
            return res.status(200).send(result.data);
        }
        catch (error) {
            return OrganizationController.handleError(error, res, "Failed to export audit log");
        }
    }
}
exports.OrganizationController = OrganizationController;
