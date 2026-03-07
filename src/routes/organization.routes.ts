import { Router } from "express";
import { verifyToken } from "../middleware/auth.middleware";
import { requireOrgRole } from "../middleware/orgAuthorization.middleware";
import { auditAction } from "../middleware/auditLog.middleware";
import { OrganizationController } from "../controllers/organization.controller";

const router = Router();

// All routes require JWT authentication
// ──────────────────────────────────────────────
// Organization CRUD
// ──────────────────────────────────────────────

// POST /organizations — Create org
router.post(
  "/",
  verifyToken,
  OrganizationController.createOrganization
);

// GET /organizations — List user's orgs
router.get(
  "/",
  verifyToken,
  OrganizationController.listOrganizations
);

// GET /organizations/:orgId — Get org (any member can view)
router.get(
  "/:orgId",
  verifyToken,
  requireOrgRole("owner", "admin", "member", "viewer"),
  OrganizationController.getOrganization
);

// PUT /organizations/:orgId — Update org (owner/admin only)
router.put(
  "/:orgId",
  verifyToken,
  requireOrgRole("owner", "admin"),
  auditAction("organization.updated", "organization"),
  OrganizationController.updateOrganization
);

// DELETE /organizations/:orgId — Delete org (owner only)
router.delete(
  "/:orgId",
  verifyToken,
  requireOrgRole("owner"),
  auditAction("organization.deleted", "organization"),
  OrganizationController.deleteOrganization
);

// ──────────────────────────────────────────────
// Organization Members
// ──────────────────────────────────────────────

// GET /organizations/:orgId/members — List members
router.get(
  "/:orgId/members",
  verifyToken,
  requireOrgRole("owner", "admin", "member", "viewer"),
  OrganizationController.listMembers
);

// POST /organizations/:orgId/members — Add/invite member (owner/admin)
router.post(
  "/:orgId/members",
  verifyToken,
  requireOrgRole("owner", "admin"),
  auditAction("member.invited", "member"),
  OrganizationController.addMember
);

// DELETE /organizations/:orgId/members/:userId — Remove member (owner/admin)
router.delete(
  "/:orgId/members/:userId",
  verifyToken,
  requireOrgRole("owner", "admin"),
  auditAction("member.removed", "member"),
  OrganizationController.removeMember
);

// PUT /organizations/:orgId/members/:userId — Update member role (owner/admin)
router.put(
  "/:orgId/members/:userId",
  verifyToken,
  requireOrgRole("owner", "admin"),
  auditAction("member.role_updated", "member"),
  OrganizationController.updateMemberRole
);

// POST /organizations/:orgId/invites/accept — Accept invite (authenticated user)
router.post(
  "/:orgId/invites/accept",
  verifyToken,
  auditAction("member.invite_accepted", "member"),
  OrganizationController.acceptInvite
);

// ──────────────────────────────────────────────
// Teams
// ──────────────────────────────────────────────

// POST /organizations/:orgId/teams — Create team (owner/admin)
router.post(
  "/:orgId/teams",
  verifyToken,
  requireOrgRole("owner", "admin"),
  auditAction("team.created", "team"),
  OrganizationController.createTeam
);

// GET /organizations/:orgId/teams — List teams
router.get(
  "/:orgId/teams",
  verifyToken,
  requireOrgRole("owner", "admin", "member", "viewer"),
  OrganizationController.listTeams
);

// GET /organizations/:orgId/teams/:teamId — Get team
router.get(
  "/:orgId/teams/:teamId",
  verifyToken,
  requireOrgRole("owner", "admin", "member", "viewer"),
  OrganizationController.getTeam
);

// PUT /organizations/:orgId/teams/:teamId — Update team (owner/admin)
router.put(
  "/:orgId/teams/:teamId",
  verifyToken,
  requireOrgRole("owner", "admin"),
  auditAction("team.updated", "team"),
  OrganizationController.updateTeam
);

// DELETE /organizations/:orgId/teams/:teamId — Delete team (owner/admin)
router.delete(
  "/:orgId/teams/:teamId",
  verifyToken,
  requireOrgRole("owner", "admin"),
  auditAction("team.deleted", "team"),
  OrganizationController.deleteTeam
);

// POST /organizations/:orgId/teams/:teamId/members — Add team member (owner/admin)
router.post(
  "/:orgId/teams/:teamId/members",
  verifyToken,
  requireOrgRole("owner", "admin"),
  auditAction("team.member_added", "team"),
  OrganizationController.addTeamMember
);

// DELETE /organizations/:orgId/teams/:teamId/members/:userId — Remove team member (owner/admin)
router.delete(
  "/:orgId/teams/:teamId/members/:userId",
  verifyToken,
  requireOrgRole("owner", "admin"),
  auditAction("team.member_removed", "team"),
  OrganizationController.removeTeamMember
);

// PUT /organizations/:orgId/teams/:teamId/access — Set project access (owner/admin)
router.put(
  "/:orgId/teams/:teamId/access",
  verifyToken,
  requireOrgRole("owner", "admin"),
  auditAction("team.access_updated", "team"),
  OrganizationController.setProjectAccess
);

// ──────────────────────────────────────────────
// Audit Log
// ──────────────────────────────────────────────

// GET /organizations/:orgId/audit-log — Query audit log (owner/admin)
router.get(
  "/:orgId/audit-log",
  verifyToken,
  requireOrgRole("owner", "admin"),
  OrganizationController.queryAuditLog
);

// POST /organizations/:orgId/audit-log/export — Export audit log (owner/admin)
router.post(
  "/:orgId/audit-log/export",
  verifyToken,
  requireOrgRole("owner", "admin"),
  OrganizationController.exportAuditLog
);

export default router;
