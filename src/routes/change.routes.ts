import { Router } from "express";
import { ChangeController } from "../controllers/change.controller";
import { ErrorGroupController } from "../controllers/errorGroup.controller";
import { authenticateApiKey, verifyToken } from "../middleware/auth.middleware";
import {
  authorizeProjectAccess,
  requireProjectAdmin,
} from "../middleware/authorizeProjectAccess";

/**
 * Change Intelligence routes (Phase 7): change feed, deployments,
 * releases, and error groups. Mounted under /api/v1.
 *
 * Every JWT route checks project membership: reads need any team member,
 * changes need the owner or an admin. The CI deploy route uses the API key.
 */
const router = Router();

// --- Change feed ---
router.get(
  "/projects/:projectId/changes",
  verifyToken,
  authorizeProjectAccess,
  ChangeController.getChanges,
);
router.post(
  "/projects/:projectId/changes/retry-summaries",
  verifyToken,
  requireProjectAdmin,
  ChangeController.retrySummaries,
);
router.post(
  "/projects/:projectId/changes/backfill",
  verifyToken,
  requireProjectAdmin,
  ChangeController.backfill,
);
router.post(
  "/projects/:projectId/changes/:sha/explain",
  verifyToken,
  authorizeProjectAccess,
  ChangeController.explainChange,
);

// --- Deployments & releases ---
// Manual deploy notification from CI (API key, same auth as log ingestion)
router.post(
  "/projects/:projectId/deployments",
  authenticateApiKey,
  ChangeController.recordDeployment,
);
router.get(
  "/projects/:projectId/deployments",
  verifyToken,
  authorizeProjectAccess,
  ChangeController.getDeployments,
);
router.get(
  "/projects/:projectId/deploy-markers",
  verifyToken,
  authorizeProjectAccess,
  ChangeController.getDeployMarkers,
);
router.get(
  "/projects/:projectId/releases/:release/health",
  verifyToken,
  authorizeProjectAccess,
  ChangeController.getReleaseHealth,
);

// --- Error groups ---
router.get(
  "/projects/:projectId/error-groups",
  verifyToken,
  authorizeProjectAccess,
  ErrorGroupController.list,
);
router.get(
  "/projects/:projectId/error-groups/:groupId",
  verifyToken,
  authorizeProjectAccess,
  ErrorGroupController.detail,
);
router.patch(
  "/projects/:projectId/error-groups/:groupId",
  verifyToken,
  requireProjectAdmin,
  ErrorGroupController.updateStatus,
);
router.get(
  "/projects/:projectId/error-groups/:groupId/issue-draft",
  verifyToken,
  authorizeProjectAccess,
  ErrorGroupController.issueDraft,
);
router.post(
  "/projects/:projectId/error-groups/:groupId/create-issue",
  verifyToken,
  requireProjectAdmin,
  ErrorGroupController.createIssue,
);

export default router;
