import { Router } from "express";
import { ChangeController } from "../controllers/change.controller";
import { ErrorGroupController } from "../controllers/errorGroup.controller";
import { authenticateApiKey, verifyToken } from "../middleware/auth.middleware";

/**
 * Change Intelligence routes (Phase 7): change feed, deployments,
 * releases, and error groups. Mounted under /api/v1.
 */
const router = Router();

// --- Change feed ---
router.get(
  "/projects/:projectId/changes",
  verifyToken,
  ChangeController.getChanges,
);
router.post(
  "/projects/:projectId/changes/retry-summaries",
  verifyToken,
  ChangeController.retrySummaries,
);
router.post(
  "/projects/:projectId/changes/backfill",
  verifyToken,
  ChangeController.backfill,
);
router.post(
  "/projects/:projectId/changes/:sha/explain",
  verifyToken,
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
  ChangeController.getDeployments,
);
router.get(
  "/projects/:projectId/deploy-markers",
  verifyToken,
  ChangeController.getDeployMarkers,
);
router.get(
  "/projects/:projectId/releases/:release/health",
  verifyToken,
  ChangeController.getReleaseHealth,
);

// --- Error groups ---
router.get(
  "/projects/:projectId/error-groups",
  verifyToken,
  ErrorGroupController.list,
);
router.get(
  "/projects/:projectId/error-groups/:groupId",
  verifyToken,
  ErrorGroupController.detail,
);
router.patch(
  "/projects/:projectId/error-groups/:groupId",
  verifyToken,
  ErrorGroupController.updateStatus,
);
router.get(
  "/projects/:projectId/error-groups/:groupId/issue-draft",
  verifyToken,
  ErrorGroupController.issueDraft,
);
router.post(
  "/projects/:projectId/error-groups/:groupId/create-issue",
  verifyToken,
  ErrorGroupController.createIssue,
);

export default router;
