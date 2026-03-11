"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const orgAuthorization_middleware_1 = require("../middleware/orgAuthorization.middleware");
const auditLog_middleware_1 = require("../middleware/auditLog.middleware");
const organization_controller_1 = require("../controllers/organization.controller");
const router = (0, express_1.Router)();
// All routes require JWT authentication
// ──────────────────────────────────────────────
// Organization CRUD
// ──────────────────────────────────────────────
// POST /organizations — Create org
router.post("/", auth_middleware_1.verifyToken, organization_controller_1.OrganizationController.createOrganization);
// GET /organizations — List user's orgs
router.get("/", auth_middleware_1.verifyToken, organization_controller_1.OrganizationController.listOrganizations);
// GET /organizations/:orgId — Get org (any member can view)
router.get("/:orgId", auth_middleware_1.verifyToken, (0, orgAuthorization_middleware_1.requireOrgRole)("owner", "admin", "member", "viewer"), organization_controller_1.OrganizationController.getOrganization);
// PUT /organizations/:orgId — Update org (owner/admin only)
router.put("/:orgId", auth_middleware_1.verifyToken, (0, orgAuthorization_middleware_1.requireOrgRole)("owner", "admin"), (0, auditLog_middleware_1.auditAction)("organization.updated", "organization"), organization_controller_1.OrganizationController.updateOrganization);
// DELETE /organizations/:orgId — Delete org (owner only)
router.delete("/:orgId", auth_middleware_1.verifyToken, (0, orgAuthorization_middleware_1.requireOrgRole)("owner"), (0, auditLog_middleware_1.auditAction)("organization.deleted", "organization"), organization_controller_1.OrganizationController.deleteOrganization);
// ──────────────────────────────────────────────
// Organization Members
// ──────────────────────────────────────────────
// GET /organizations/:orgId/members — List members
router.get("/:orgId/members", auth_middleware_1.verifyToken, (0, orgAuthorization_middleware_1.requireOrgRole)("owner", "admin", "member", "viewer"), organization_controller_1.OrganizationController.listMembers);
// POST /organizations/:orgId/members — Add/invite member (owner/admin)
router.post("/:orgId/members", auth_middleware_1.verifyToken, (0, orgAuthorization_middleware_1.requireOrgRole)("owner", "admin"), (0, auditLog_middleware_1.auditAction)("member.invited", "member"), organization_controller_1.OrganizationController.addMember);
// DELETE /organizations/:orgId/members/:userId — Remove member (owner/admin)
router.delete("/:orgId/members/:userId", auth_middleware_1.verifyToken, (0, orgAuthorization_middleware_1.requireOrgRole)("owner", "admin"), (0, auditLog_middleware_1.auditAction)("member.removed", "member"), organization_controller_1.OrganizationController.removeMember);
// PUT /organizations/:orgId/members/:userId — Update member role (owner/admin)
router.put("/:orgId/members/:userId", auth_middleware_1.verifyToken, (0, orgAuthorization_middleware_1.requireOrgRole)("owner", "admin"), (0, auditLog_middleware_1.auditAction)("member.role_updated", "member"), organization_controller_1.OrganizationController.updateMemberRole);
// POST /organizations/:orgId/invites/accept — Accept invite (authenticated user)
router.post("/:orgId/invites/accept", auth_middleware_1.verifyToken, (0, auditLog_middleware_1.auditAction)("member.invite_accepted", "member"), organization_controller_1.OrganizationController.acceptInvite);
// ──────────────────────────────────────────────
// Teams
// ──────────────────────────────────────────────
// POST /organizations/:orgId/teams — Create team (owner/admin)
router.post("/:orgId/teams", auth_middleware_1.verifyToken, (0, orgAuthorization_middleware_1.requireOrgRole)("owner", "admin"), (0, auditLog_middleware_1.auditAction)("team.created", "team"), organization_controller_1.OrganizationController.createTeam);
// GET /organizations/:orgId/teams — List teams
router.get("/:orgId/teams", auth_middleware_1.verifyToken, (0, orgAuthorization_middleware_1.requireOrgRole)("owner", "admin", "member", "viewer"), organization_controller_1.OrganizationController.listTeams);
// GET /organizations/:orgId/teams/:teamId — Get team
router.get("/:orgId/teams/:teamId", auth_middleware_1.verifyToken, (0, orgAuthorization_middleware_1.requireOrgRole)("owner", "admin", "member", "viewer"), organization_controller_1.OrganizationController.getTeam);
// PUT /organizations/:orgId/teams/:teamId — Update team (owner/admin)
router.put("/:orgId/teams/:teamId", auth_middleware_1.verifyToken, (0, orgAuthorization_middleware_1.requireOrgRole)("owner", "admin"), (0, auditLog_middleware_1.auditAction)("team.updated", "team"), organization_controller_1.OrganizationController.updateTeam);
// DELETE /organizations/:orgId/teams/:teamId — Delete team (owner/admin)
router.delete("/:orgId/teams/:teamId", auth_middleware_1.verifyToken, (0, orgAuthorization_middleware_1.requireOrgRole)("owner", "admin"), (0, auditLog_middleware_1.auditAction)("team.deleted", "team"), organization_controller_1.OrganizationController.deleteTeam);
// POST /organizations/:orgId/teams/:teamId/members — Add team member (owner/admin)
router.post("/:orgId/teams/:teamId/members", auth_middleware_1.verifyToken, (0, orgAuthorization_middleware_1.requireOrgRole)("owner", "admin"), (0, auditLog_middleware_1.auditAction)("team.member_added", "team"), organization_controller_1.OrganizationController.addTeamMember);
// DELETE /organizations/:orgId/teams/:teamId/members/:userId — Remove team member (owner/admin)
router.delete("/:orgId/teams/:teamId/members/:userId", auth_middleware_1.verifyToken, (0, orgAuthorization_middleware_1.requireOrgRole)("owner", "admin"), (0, auditLog_middleware_1.auditAction)("team.member_removed", "team"), organization_controller_1.OrganizationController.removeTeamMember);
// PUT /organizations/:orgId/teams/:teamId/access — Set project access (owner/admin)
router.put("/:orgId/teams/:teamId/access", auth_middleware_1.verifyToken, (0, orgAuthorization_middleware_1.requireOrgRole)("owner", "admin"), (0, auditLog_middleware_1.auditAction)("team.access_updated", "team"), organization_controller_1.OrganizationController.setProjectAccess);
// ──────────────────────────────────────────────
// Audit Log
// ──────────────────────────────────────────────
// GET /organizations/:orgId/audit-log — Query audit log (owner/admin)
router.get("/:orgId/audit-log", auth_middleware_1.verifyToken, (0, orgAuthorization_middleware_1.requireOrgRole)("owner", "admin"), organization_controller_1.OrganizationController.queryAuditLog);
// POST /organizations/:orgId/audit-log/export — Export audit log (owner/admin)
router.post("/:orgId/audit-log/export", auth_middleware_1.verifyToken, (0, orgAuthorization_middleware_1.requireOrgRole)("owner", "admin"), organization_controller_1.OrganizationController.exportAuditLog);
exports.default = router;
