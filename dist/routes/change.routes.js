"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const change_controller_1 = require("../controllers/change.controller");
const errorGroup_controller_1 = require("../controllers/errorGroup.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
/**
 * Change Intelligence routes (Phase 7): change feed, deployments,
 * releases, and error groups. Mounted under /api/v1.
 */
const router = (0, express_1.Router)();
// --- Change feed ---
router.get("/projects/:projectId/changes", auth_middleware_1.verifyToken, change_controller_1.ChangeController.getChanges);
router.post("/projects/:projectId/changes/retry-summaries", auth_middleware_1.verifyToken, change_controller_1.ChangeController.retrySummaries);
router.post("/projects/:projectId/changes/backfill", auth_middleware_1.verifyToken, change_controller_1.ChangeController.backfill);
router.post("/projects/:projectId/changes/:sha/explain", auth_middleware_1.verifyToken, change_controller_1.ChangeController.explainChange);
// --- Deployments & releases ---
// Manual deploy notification from CI (API key, same auth as log ingestion)
router.post("/projects/:projectId/deployments", auth_middleware_1.authenticateApiKey, change_controller_1.ChangeController.recordDeployment);
router.get("/projects/:projectId/deployments", auth_middleware_1.verifyToken, change_controller_1.ChangeController.getDeployments);
router.get("/projects/:projectId/deploy-markers", auth_middleware_1.verifyToken, change_controller_1.ChangeController.getDeployMarkers);
router.get("/projects/:projectId/releases/:release/health", auth_middleware_1.verifyToken, change_controller_1.ChangeController.getReleaseHealth);
// --- Error groups ---
router.get("/projects/:projectId/error-groups", auth_middleware_1.verifyToken, errorGroup_controller_1.ErrorGroupController.list);
router.get("/projects/:projectId/error-groups/:groupId", auth_middleware_1.verifyToken, errorGroup_controller_1.ErrorGroupController.detail);
router.patch("/projects/:projectId/error-groups/:groupId", auth_middleware_1.verifyToken, errorGroup_controller_1.ErrorGroupController.updateStatus);
router.get("/projects/:projectId/error-groups/:groupId/issue-draft", auth_middleware_1.verifyToken, errorGroup_controller_1.ErrorGroupController.issueDraft);
router.post("/projects/:projectId/error-groups/:groupId/create-issue", auth_middleware_1.verifyToken, errorGroup_controller_1.ErrorGroupController.createIssue);
exports.default = router;
