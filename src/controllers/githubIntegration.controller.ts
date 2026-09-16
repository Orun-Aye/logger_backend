import { Request, Response } from "express";
import { Types } from "mongoose";
import { GithubOAuthService } from "../services/integrations/github-oauth.service";
import { GithubAppService } from "../services/integrations/github-app.service";
import { GitHubApiError } from "../services/integrations/github-client";
import { ProjectModel } from "../models/project.model";
import { ChangeService } from "../services/change.service";
import logger from "../utils/logger";

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

/**
 * Where a user goes on github.com to add or remove repositories from an
 * existing installation. Org installs live under the org's settings, personal
 * ones under the user's own.
 */
function buildInstallationManageUrl(
  accountType: "User" | "Organization",
  accountLogin: string,
): string {
  return accountType === "Organization"
    ? `https://github.com/organizations/${accountLogin}/settings/installations`
    : "https://github.com/settings/installations";
}

/**
 * Append query params to a URL that may already carry a query string.
 * Used to hand the frontend a result code after an external redirect.
 */
function withParams(url: string, params: Record<string, string>): string {
  const separator = url.includes("?") ? "&" : "?";
  const query = new URLSearchParams(params).toString();
  return `${url}${separator}${query}`;
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

  /**
   * GitHub App installation status. Tells the frontend whether the App is
   * configured platform-side, which installations this user can see, and
   * whether one of them covers a specific repo.
   */
  async getAppStatus(req: Request, res: Response) {
    const userId = req.userId;
    if (!userId) return fail(res, 401, "Authentication required");
    try {
      const enabled = GithubAppService.isEnabled();
      const owner =
        typeof req.query.owner === "string" ? req.query.owner : undefined;
      const repo =
        typeof req.query.repo === "string" ? req.query.repo : undefined;

      let coversRepo: boolean | undefined;
      let coveringInstallationId: number | undefined;
      if (enabled && owner && repo) {
        const installation = await GithubAppService.findInstallationForRepo(
          owner,
          repo
        );
        coversRepo = Boolean(installation);
        coveringInstallationId = installation?.installationId;
      }

      // The OAuth login lets us surface installs the user made straight from
      // github.com, which carry no `state` and so no installedByUserId.
      let githubLogin: string | undefined;
      try {
        githubLogin = (await GithubOAuthService.getStatus(userId)).githubLogin;
      } catch {
        // A missing OAuth connection just narrows the installation list.
      }

      const installations = enabled
        ? await GithubAppService.listInstallationsForUser(userId, githubLogin)
        : [];

      return ok(res, {
        enabled,
        installUrl: enabled ? GithubAppService.getInstallUrl() : null,
        coversRepo,
        coveringInstallationId,
        installations: installations.map((i) => ({
          installationId: i.installationId,
          accountLogin: i.accountLogin,
          accountType: i.accountType,
          repositorySelection: i.repositorySelection,
          repositories: (i.repositories || []).map((r) => r.fullName),
          suspended: i.suspended,
          installedAt: i.createdAt,
          manageUrl: buildInstallationManageUrl(i.accountType, i.accountLogin),
        })),
      });
    } catch (err) {
      return fail(res, 500, (err as Error).message);
    }
  },

  // ------------------------------------------------------------------
  // GitHub App installation (Phase 7 Change Intelligence)
  // ------------------------------------------------------------------

  /**
   * Kick off a GitHub App installation. This is hit by a top-level browser
   * navigation, so authentication is optional (see `optionalAuth`): an
   * anonymous visitor still reaches GitHub, the install just is not attributed
   * to an Apperio user until the webhook lands.
   */
  async startAppInstall(req: Request, res: Response) {
    try {
      const returnTo =
        typeof req.query.returnTo === "string" ? req.query.returnTo : undefined;

      if (!GithubAppService.isEnabled()) {
        // The install screen itself only needs the App slug, so continue.
        // Token minting will fail later until the env group is complete.
        logger.warn(
          "GithubApp: install started while App credentials are incomplete"
        );
      }

      const state = GithubAppService.createInstallState({
        userId: req.userId,
        returnTo,
      });
      return res.redirect(GithubAppService.getInstallUrl(state));
    } catch (err) {
      return fail(res, 500, (err as Error).message);
    }
  },

  /**
   * GitHub App Setup URL target. GitHub sends the browser here after an
   * install with `installation_id`, `setup_action` and our `state`.
   *
   * Identity comes from `state`, never a JWT, so this MUST NOT sit behind
   * verifyToken. Storage is idempotent and shared with the `installation`
   * webhook, which may arrive before or after this request.
   */
  async appSetupCallback(req: Request, res: Response) {
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const setupAction =
      typeof req.query.setup_action === "string" ? req.query.setup_action : "";
    const record = state ? GithubAppService.consumeInstallState(state) : null;
    const target =
      record?.returnTo || `${frontendBaseUrl()}/settings/integrations`;

    const installationId = Number.parseInt(
      String(req.query.installation_id ?? ""),
      10
    );

    if (!Number.isInteger(installationId) || installationId <= 0) {
      // setup_action=request means an org member asked an owner to approve;
      // there is no installation to record yet.
      return res.redirect(
        withParams(target, {
          github_app: setupAction === "request" ? "requested" : "error",
        })
      );
    }

    try {
      await GithubAppService.syncInstallationById(
        installationId,
        record?.userId
      );
      return res.redirect(
        withParams(target, {
          github_app: "installed",
          installation_id: String(installationId),
        })
      );
    } catch (err) {
      // The install succeeded on GitHub even if we could not read it back
      // (missing App id/key, API hiccup). The webhook is the backstop.
      logger.warn("GithubApp: setup callback could not sync installation", {
        installationId,
        error: (err as Error).message,
      });
      return res.redirect(withParams(target, { github_app: "pending" }));
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

      // Phase 7: import recent commits + releases so the feed starts populated
      void ChangeService.backfillProject(projectId);

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
