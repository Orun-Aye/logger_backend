"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const githubIntegration_controller_1 = require("../controllers/githubIntegration.controller");
const router = (0, express_1.Router)();
// User-scoped GitHub OAuth + connection management
router.get("/integrations/github/connect", auth_middleware_1.verifyToken, githubIntegration_controller_1.GithubIntegrationController.startOAuth);
// OAuth callback — auth comes from the OAuth `state` token, NOT a JWT.
// Mounting WITHOUT verifyToken on purpose.
router.get("/integrations/github/callback", githubIntegration_controller_1.GithubIntegrationController.oauthCallback);
router.get("/integrations/github/status", auth_middleware_1.verifyToken, githubIntegration_controller_1.GithubIntegrationController.getStatus);
// GitHub App installation status (Phase 7 Change Intelligence)
router.get("/integrations/github/app-status", auth_middleware_1.verifyToken, githubIntegration_controller_1.GithubIntegrationController.getAppStatus);
router.delete("/integrations/github/disconnect", auth_middleware_1.verifyToken, githubIntegration_controller_1.GithubIntegrationController.disconnect);
router.get("/integrations/github/repos", auth_middleware_1.verifyToken, githubIntegration_controller_1.GithubIntegrationController.listRepos);
// Project-scoped repo link + commits proxy
router.post("/projects/:projectId/github-link", auth_middleware_1.verifyToken, githubIntegration_controller_1.GithubIntegrationController.linkRepo);
router.delete("/projects/:projectId/github-link", auth_middleware_1.verifyToken, githubIntegration_controller_1.GithubIntegrationController.unlinkRepo);
router.get("/projects/:projectId/recent-commits", auth_middleware_1.verifyToken, githubIntegration_controller_1.GithubIntegrationController.getRecentCommits);
exports.default = router;
