import { Router } from "express";
import { verifyToken } from "../middleware/auth.middleware";
import { GithubIntegrationController } from "../controllers/githubIntegration.controller";

const router = Router();

// User-scoped GitHub OAuth + connection management
router.get(
  "/integrations/github/connect",
  verifyToken,
  GithubIntegrationController.startOAuth,
);

// OAuth callback — auth comes from the OAuth `state` token, NOT a JWT.
// Mounting WITHOUT verifyToken on purpose.
router.get(
  "/integrations/github/callback",
  GithubIntegrationController.oauthCallback,
);

router.get(
  "/integrations/github/status",
  verifyToken,
  GithubIntegrationController.getStatus,
);

router.delete(
  "/integrations/github/disconnect",
  verifyToken,
  GithubIntegrationController.disconnect,
);

router.get(
  "/integrations/github/repos",
  verifyToken,
  GithubIntegrationController.listRepos,
);

// Project-scoped repo link + commits proxy
router.post(
  "/projects/:projectId/github-link",
  verifyToken,
  GithubIntegrationController.linkRepo,
);

router.delete(
  "/projects/:projectId/github-link",
  verifyToken,
  GithubIntegrationController.unlinkRepo,
);

router.get(
  "/projects/:projectId/recent-commits",
  verifyToken,
  GithubIntegrationController.getRecentCommits,
);

export default router;
