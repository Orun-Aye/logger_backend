"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GithubAppService = void 0;
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
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../../config");
const logger_1 = __importDefault(require("../../utils/logger"));
const githubInstallation_model_1 = require("../../models/githubInstallation.model");
const github_client_1 = require("./github-client");
const github_oauth_service_1 = require("./github-oauth.service");
/** Installation token cache. GitHub tokens live 60 min; refresh at 55. */
const tokenCache = new Map();
const TOKEN_TTL_MS = 55 * 60 * 1000;
exports.GithubAppService = {
    isEnabled() {
        return Boolean(config_1.config.githubApp.appId &&
            config_1.config.githubApp.privateKey &&
            config_1.config.githubApp.webhookSecret);
    },
    /** Public URL a user visits to install the App. */
    getInstallUrl() {
        return `https://github.com/apps/${config_1.config.githubApp.slug}/installations/new`;
    },
    /** Short-lived app-level JWT used to mint installation tokens. */
    createAppJwt() {
        const now = Math.floor(Date.now() / 1000);
        return jsonwebtoken_1.default.sign({
            iat: now - 60, // clock drift allowance
            exp: now + 9 * 60, // GitHub max is 10 minutes
            iss: config_1.config.githubApp.appId,
        }, config_1.config.githubApp.privateKey, { algorithm: "RS256" });
    },
    /** Mint (or reuse a cached) installation access token. */
    async getInstallationToken(installationId) {
        const cached = tokenCache.get(installationId);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.token;
        }
        const appJwt = this.createAppJwt();
        const result = await (0, github_client_1.githubApiCall)(appJwt, `/app/installations/${installationId}/access_tokens`, { method: "POST" });
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
    async findInstallationForRepo(owner, repo) {
        const fullName = `${owner}/${repo}`;
        return githubInstallation_model_1.GithubInstallationModel.findOne({
            suspended: false,
            $or: [
                { "repositories.fullName": fullName },
                { repositorySelection: "all", accountLogin: owner },
            ],
        }).lean();
    },
    /**
     * Resolve the best available GitHub token for a repo.
     * Prefers an App installation token; falls back to the OAuth token of the
     * user who linked the repo (legacy path). Returns null when neither exists.
     */
    async getTokenForRepo(owner, repo, fallbackUserId) {
        if (this.isEnabled()) {
            try {
                const installation = await this.findInstallationForRepo(owner, repo);
                if (installation) {
                    const token = await this.getInstallationToken(installation.installationId);
                    return { token, via: "installation" };
                }
            }
            catch (error) {
                logger_1.default.warn("GithubApp: installation token resolution failed", {
                    owner,
                    repo,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
        if (fallbackUserId) {
            try {
                const token = await github_oauth_service_1.GithubOAuthService.getTokenForUser(fallbackUserId);
                return { token, via: "oauth" };
            }
            catch (error) {
                if (!(error instanceof github_client_1.GitHubApiError && error.status === 404)) {
                    logger_1.default.warn("GithubApp: OAuth fallback token failed", {
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
    async handleInstallationEvent(payload) {
        const installation = payload?.installation;
        if (!installation?.id)
            return;
        const action = payload.action;
        if (action === "deleted") {
            await githubInstallation_model_1.GithubInstallationModel.deleteOne({
                installationId: installation.id,
            });
            tokenCache.delete(installation.id);
            logger_1.default.info("GithubApp: installation removed", {
                installationId: installation.id,
            });
            return;
        }
        if (action === "suspend" || action === "unsuspend") {
            await githubInstallation_model_1.GithubInstallationModel.updateOne({ installationId: installation.id }, { $set: { suspended: action === "suspend" } });
            if (action === "suspend")
                tokenCache.delete(installation.id);
            return;
        }
        // created / new_permissions_accepted / repository selection changes
        const repositories = [];
        const rawRepos = payload.repositories ||
            payload.repositories_added ||
            [];
        for (const r of rawRepos) {
            if (r?.id && r?.full_name) {
                repositories.push({ id: r.id, fullName: r.full_name });
            }
        }
        const update = {
            accountLogin: installation.account?.login || "unknown",
            accountId: installation.account?.id || 0,
            accountType: installation.account?.type === "Organization" ? "Organization" : "User",
            repositorySelection: installation.repository_selection === "all" ? "all" : "selected",
            suspended: Boolean(installation.suspended_at),
        };
        const existing = await githubInstallation_model_1.GithubInstallationModel.findOne({
            installationId: installation.id,
        });
        if (!existing) {
            await githubInstallation_model_1.GithubInstallationModel.create({
                installationId: installation.id,
                ...update,
                repositories,
            });
            logger_1.default.info("GithubApp: installation recorded", {
                installationId: installation.id,
                account: update.accountLogin,
            });
            return;
        }
        // Merge repo additions/removals for installation_repositories events
        let repoList = existing.repositories || [];
        if (payload.repositories_added) {
            const additions = payload.repositories_added
                .filter((r) => r?.id && r?.full_name)
                .map((r) => ({ id: r.id, fullName: r.full_name }));
            const known = new Set(repoList.map((r) => r.id));
            repoList = repoList.concat(additions.filter((r) => !known.has(r.id)));
        }
        if (payload.repositories_removed) {
            const removed = new Set(payload.repositories_removed.map((r) => r?.id));
            repoList = repoList.filter((r) => !removed.has(r.id));
        }
        if (payload.repositories) {
            repoList = repositories;
        }
        existing.set({ ...update, repositories: repoList });
        await existing.save();
    },
};
