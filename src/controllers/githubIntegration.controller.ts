import { Request, Response } from "express";
import { Types } from "mongoose";
import { GithubOAuthService } from "../services/integrations/github-oauth.service";
import { GitHubApiError } from "../services/integrations/github-client";
import { ProjectModel } from "../models/project.model";

function ok<T>(res: Response, data: T) {
  return res.json({ status: "success", data });
}

function fail(res: Response, status: number, message: string) {
  return res.status(status).json({ status: "error", message });
}

function buildRedirectUri(req: Request): string {
  if (process.env.GITHUB_INTEGRATION_REDIRECT_URI) {
    return process.env.GITHUB_INTEGRATION_REDIRECT_URI;
  }
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host");
  return `${proto}://${host}/api/v1/integrations/github/callback`;
}

function frontendBaseUrl(): string {
  return (
    process.env.FRONTEND_URL ||
    process.env.CORS_ORIGIN ||
    "https://www.apperio.dev"
  );
}

export const GithubIntegrationController = {
  // ------------------------------------------------------------------
  // GitHub OAuth lifecycle
  // ------------------------------------------------------------------

  async startOAuth(req: Request, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) return fail(res, 401, "Authentication required");
      const returnTo =
        typeof req.query.returnTo === "string" ? req.query.returnTo : undefined;
      const redirectUri = buildRedirectUri(req);
      const authorizeUrl = GithubOAuthService.getAuthorizeUrl({
        userId,
        redirectUri,
        returnTo,
      });
      return res.redirect(authorizeUrl);
    } catch (err) {
      return fail(res, 500, (err as Error).message);
    }
  },

  /**
   * OAuth callback — auth comes from the OAuth `state` token, not from a JWT.
   * MUST NOT be wrapped in verifyToken.
   */
  async oauthCallback(req: Request, res: Response) {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    if (!code || !state) {
      return fail(res, 400, "Missing code or state");
    }
    try {
      const { returnTo } = await GithubOAuthService.completeOAuth({
        code,
        state,
      });
      const fallback = `${frontendBaseUrl()}/settings/integrations?github=connected`;
      return res.redirect(returnTo || fallback);
    } catch (err) {
      const url = `${frontendBaseUrl()}/settings/integrations?github=error&message=${encodeURIComponent(
        (err as Error).message,
      )}`;
      return res.redirect(url);
    }
  },

  async disconnect(req: Request, res: Response) {
    const userId = req.userId;
    if (!userId) return fail(res, 401, "Authentication required");
    try {
      await GithubOAuthService.disconnect(userId);
      return ok(res, { connected: false });
    } catch (err) {
      return fail(res, 500, (err as Error).message);
    }
  },

  async getStatus(req: Request, res: Response) {
    const userId = req.userId;
    if (!userId) return fail(res, 401, "Authentication required");
    try {
      const status = await GithubOAuthService.getStatus(userId);
      return ok(res, status);
    } catch (err) {
      return fail(res, 500, (err as Error).message);
    }
  },

  async listRepos(req: Request, res: Response) {
    const userId = req.userId;
    if (!userId) return fail(res, 401, "Authentication required");
    const search =
      typeof req.query.search === "string" ? req.query.search : undefined;
    try {
      const repos = await GithubOAuthService.listRepos(userId, search);
      return ok(res, repos);
    } catch (err) {
      if (err instanceof GitHubApiError && err.status === 401) {
        return fail(
          res,
          401,
          "GitHub access token is invalid. Reconnect GitHub.",
        );
      }
      if (err instanceof GitHubApiError && err.status === 404) {
        return fail(res, 404, "GitHub account not connected");
      }
      return fail(res, 500, (err as Error).message);
    }
  },

  // ------------------------------------------------------------------
  // Per-project repo linking
  // ------------------------------------------------------------------

  async linkRepo(req: Request, res: Response) {
    const userId = req.userId;
    const { projectId } = req.params;
    if (!userId) return fail(res, 401, "Authentication required");
    if (!Types.ObjectId.isValid(projectId)) {
      return fail(res, 400, "Invalid project id");
    }

    const { owner, repo, branch } = req.body || {};
    if (typeof owner !== "string" || !owner.trim())
      return fail(res, 400, "owner is required");
    if (typeof repo !== "string" || !repo.trim())
      return fail(res, 400, "repo is required");
    const branchName =
      typeof branch === "string" && branch.trim() ? branch.trim() : "main";

    try {
      const updated = await ProjectModel.findByIdAndUpdate(
        projectId,
        {
          $set: {
            "integrationSettings.githubRepo": {
              owner: owner.trim(),
              repo: repo.trim(),
              branch: branchName,
              linkedAt: new Date(),
              linkedBy: new Types.ObjectId(userId),
            },
          },
        },
        { new: true, projection: { integrationSettings: 1 } },
      ).lean();

      if (!updated) return fail(res, 404, "Project not found");
      return ok(res, updated.integrationSettings?.githubRepo);
    } catch (err) {
      return fail(res, 500, (err as Error).message);
    }
  },

  async unlinkRepo(req: Request, res: Response) {
    const userId = req.userId;
    const { projectId } = req.params;
    if (!userId) return fail(res, 401, "Authentication required");
    if (!Types.ObjectId.isValid(projectId)) {
      return fail(res, 400, "Invalid project id");
    }
    try {
      await ProjectModel.findByIdAndUpdate(projectId, {
        $unset: { "integrationSettings.githubRepo": "" },
      });
      return ok(res, { unlinked: true });
    } catch (err) {
      return fail(res, 500, (err as Error).message);
    }
  },

  /**
   * Returns the latest commits on the project's linked branch. Uses the
   * GitHub token of whoever linked the repo so the timeline keeps working
   * when other team members view the page.
   */
  async getRecentCommits(req: Request, res: Response) {
    const { projectId } = req.params;
    if (!Types.ObjectId.isValid(projectId)) {
      return fail(res, 400, "Invalid project id");
    }
    const limitRaw = req.query.limit;
    const limit = Math.min(
      Math.max(
        Number.parseInt(typeof limitRaw === "string" ? limitRaw : "5", 10) || 5,
        1,
      ),
      30,
    );

    try {
      const project = await ProjectModel.findById(projectId)
        .select("integrationSettings ownerId")
        .lean();
      if (!project) return fail(res, 404, "Project not found");

      const link = project.integrationSettings?.githubRepo;
      if (!link?.owner || !link.repo) {
        return fail(res, 404, "No GitHub repo linked to this project");
      }

      const tokenUserId =
        link.linkedBy?.toString() || project.ownerId?.toString();
      if (!tokenUserId) {
        return fail(
          res,
          404,
          "No GitHub-connected user available for this project",
        );
      }

      const commits = await GithubOAuthService.listCommits({
        userId: tokenUserId,
        owner: link.owner,
        repo: link.repo,
        branch: link.branch || "main",
        limit,
      });
      return ok(res, commits);
    } catch (err) {
      if (err instanceof GitHubApiError) {
        if (err.status === 401 || err.status === 403) {
          return fail(
            res,
            err.status,
            "GitHub access denied — reconnect or check repo permissions",
          );
        }
        if (err.status === 404) {
          return fail(res, 404, "Linked repo not accessible from GitHub");
        }
      }
      return fail(res, 500, (err as Error).message);
    }
  },
};
