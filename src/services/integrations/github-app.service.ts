/**
 * GitHub App service — installation-based access for Change Intelligence.
 *
 * Unlike the user-OAuth flow ([github-oauth.service.ts]), a GitHub App
 * installation is repo-scoped, org-friendly, and does not depend on any one
 * user's personal token. Access works via short-lived installation tokens
 * minted with an app-level JWT (RS256, signed with the App private key).
 *
 * All Phase 7 features prefer installation tokens and fall back to the
 * linking user's OAuth token when no installation covers the repo.
 */
import jwt from "jsonwebtoken";
import { config } from "../../config";
import logger from "../../utils/logger";
import {
  GithubInstallationModel,
  IGithubInstallation,
} from "../../models/githubInstallation.model";
import { githubApiCall, GitHubApiError } from "./github-client";
import { GithubOAuthService } from "./github-oauth.service";

interface CachedToken {
  token: string;
  /** Epoch ms after which the token should no longer be used. */
  expiresAt: number;
}

/** Installation token cache. GitHub tokens live 60 min; refresh at 55. */
const tokenCache = new Map<number, CachedToken>();
const TOKEN_TTL_MS = 55 * 60 * 1000;

export const GithubAppService = {
  isEnabled(): boolean {
    return Boolean(
      config.githubApp.appId &&
        config.githubApp.privateKey &&
        config.githubApp.webhookSecret
    );
  },

  /** Public URL a user visits to install the App. */
  getInstallUrl(): string {
    return `https://github.com/apps/${config.githubApp.slug}/installations/new`;
  },

  /** Short-lived app-level JWT used to mint installation tokens. */
  createAppJwt(): string {
    const now = Math.floor(Date.now() / 1000);
    return jwt.sign(
      {
        iat: now - 60, // clock drift allowance
        exp: now + 9 * 60, // GitHub max is 10 minutes
        iss: config.githubApp.appId,
      },
      config.githubApp.privateKey,
      { algorithm: "RS256" }
    );
  },

  /** Mint (or reuse a cached) installation access token. */
  async getInstallationToken(installationId: number): Promise<string> {
    const cached = tokenCache.get(installationId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    const appJwt = this.createAppJwt();
    const result = await githubApiCall<{ token: string }>(
      appJwt,
      `/app/installations/${installationId}/access_tokens`,
      { method: "POST" }
    );

    tokenCache.set(installationId, {
      token: result.token,
      expiresAt: Date.now() + TOKEN_TTL_MS,
    });
    return result.token;
  },

  /**
   * Find the installation that covers a repo ("owner/repo").
   * Matches either an explicit repo grant or an "all repositories"
   * installation on the owning account.
   */
  async findInstallationForRepo(
    owner: string,
    repo: string
  ): Promise<IGithubInstallation | null> {
    const fullName = `${owner}/${repo}`;
    return GithubInstallationModel.findOne({
      suspended: false,
      $or: [
        { "repositories.fullName": fullName },
        { repositorySelection: "all", accountLogin: owner },
      ],
    }).lean<IGithubInstallation>();
  },

  /**
   * Resolve the best available GitHub token for a repo.
   * Prefers an App installation token; falls back to the OAuth token of the
   * user who linked the repo (legacy path). Returns null when neither exists.
   */
  async getTokenForRepo(
    owner: string,
    repo: string,
    fallbackUserId?: string
  ): Promise<{ token: string; via: "installation" | "oauth" } | null> {
    if (this.isEnabled()) {
      try {
        const installation = await this.findInstallationForRepo(owner, repo);
        if (installation) {
          const token = await this.getInstallationToken(
            installation.installationId
          );
          return { token, via: "installation" };
        }
      } catch (error) {
        logger.warn("GithubApp: installation token resolution failed", {
          owner,
          repo,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (fallbackUserId) {
      try {
        const token = await GithubOAuthService.getTokenForUser(fallbackUserId);
        return { token, via: "oauth" };
      } catch (error) {
        if (!(error instanceof GitHubApiError && error.status === 404)) {
          logger.warn("GithubApp: OAuth fallback token failed", {
            owner,
            repo,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    return null;
  },

  /**
   * Sync installation state from `installation` / `installation_repositories`
   * webhook events.
   */
  async handleInstallationEvent(payload: any): Promise<void> {
    const installation = payload?.installation;
    if (!installation?.id) return;

    const action = payload.action as string;

    if (action === "deleted") {
      await GithubInstallationModel.deleteOne({
        installationId: installation.id,
      });
      tokenCache.delete(installation.id);
      logger.info("GithubApp: installation removed", {
        installationId: installation.id,
      });
      return;
    }

    if (action === "suspend" || action === "unsuspend") {
      await GithubInstallationModel.updateOne(
        { installationId: installation.id },
        { $set: { suspended: action === "suspend" } }
      );
      if (action === "suspend") tokenCache.delete(installation.id);
      return;
    }

    // created / new_permissions_accepted / repository selection changes
    const repositories: Array<{ id: number; fullName: string }> = [];
    const rawRepos =
      payload.repositories ||
      payload.repositories_added ||
      [];
    for (const r of rawRepos) {
      if (r?.id && r?.full_name) {
        repositories.push({ id: r.id, fullName: r.full_name });
      }
    }

    const update: Record<string, any> = {
      accountLogin: installation.account?.login || "unknown",
      accountId: installation.account?.id || 0,
      accountType: installation.account?.type === "Organization" ? "Organization" : "User",
      repositorySelection: installation.repository_selection === "all" ? "all" : "selected",
      suspended: Boolean(installation.suspended_at),
    };

    const existing = await GithubInstallationModel.findOne({
      installationId: installation.id,
    });

    if (!existing) {
      await GithubInstallationModel.create({
        installationId: installation.id,
        ...update,
        repositories,
      });
      logger.info("GithubApp: installation recorded", {
        installationId: installation.id,
        account: update.accountLogin,
      });
      return;
    }

    // Merge repo additions/removals for installation_repositories events
    let repoList = existing.repositories || [];
    if (payload.repositories_added) {
      const additions = (payload.repositories_added as any[])
        .filter((r) => r?.id && r?.full_name)
        .map((r) => ({ id: r.id, fullName: r.full_name }));
      const known = new Set(repoList.map((r) => r.id));
      repoList = repoList.concat(additions.filter((r) => !known.has(r.id)));
    }
    if (payload.repositories_removed) {
      const removed = new Set(
        (payload.repositories_removed as any[]).map((r) => r?.id)
      );
      repoList = repoList.filter((r) => !removed.has(r.id));
    }
    if (payload.repositories) {
      repoList = repositories;
    }

    existing.set({ ...update, repositories: repoList });
    await existing.save();
  },
};
