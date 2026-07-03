"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GithubIntegrationController = void 0;
const mongoose_1 = require("mongoose");
const github_oauth_service_1 = require("../services/integrations/github-oauth.service");
const github_app_service_1 = require("../services/integrations/github-app.service");
const github_client_1 = require("../services/integrations/github-client");
const project_model_1 = require("../models/project.model");
const change_service_1 = require("../services/change.service");
function ok(res, data) {
    return res.json({ status: "success", data });
}
function fail(res, status, message) {
    return res.status(status).json({ status: "error", message });
}
function buildRedirectUri(req) {
    if (process.env.GITHUB_INTEGRATION_REDIRECT_URI) {
        return process.env.GITHUB_INTEGRATION_REDIRECT_URI;
    }
    const proto = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.headers["x-forwarded-host"] || req.get("host");
    return `${proto}://${host}/api/v1/integrations/github/callback`;
}
function frontendBaseUrl() {
    return (process.env.FRONTEND_URL ||
        process.env.CORS_ORIGIN ||
        "https://www.apperio.dev");
}
exports.GithubIntegrationController = {
    // ------------------------------------------------------------------
    // GitHub OAuth lifecycle
    // ------------------------------------------------------------------
    async startOAuth(req, res) {
        try {
            const userId = req.userId;
            if (!userId)
                return fail(res, 401, "Authentication required");
            const returnTo = typeof req.query.returnTo === "string" ? req.query.returnTo : undefined;
            const redirectUri = buildRedirectUri(req);
            const authorizeUrl = github_oauth_service_1.GithubOAuthService.getAuthorizeUrl({
                userId,
                redirectUri,
                returnTo,
            });
            return res.redirect(authorizeUrl);
        }
        catch (err) {
            return fail(res, 500, err.message);
        }
    },
    /**
     * OAuth callback — auth comes from the OAuth `state` token, not from a JWT.
     * MUST NOT be wrapped in verifyToken.
     */
    async oauthCallback(req, res) {
        const code = typeof req.query.code === "string" ? req.query.code : "";
        const state = typeof req.query.state === "string" ? req.query.state : "";
        if (!code || !state) {
            return fail(res, 400, "Missing code or state");
        }
        try {
            const { returnTo } = await github_oauth_service_1.GithubOAuthService.completeOAuth({
                code,
                state,
            });
            const fallback = `${frontendBaseUrl()}/settings/integrations?github=connected`;
            return res.redirect(returnTo || fallback);
        }
        catch (err) {
            const url = `${frontendBaseUrl()}/settings/integrations?github=error&message=${encodeURIComponent(err.message)}`;
            return res.redirect(url);
        }
    },
    async disconnect(req, res) {
        const userId = req.userId;
        if (!userId)
            return fail(res, 401, "Authentication required");
        try {
            await github_oauth_service_1.GithubOAuthService.disconnect(userId);
            return ok(res, { connected: false });
        }
        catch (err) {
            return fail(res, 500, err.message);
        }
    },
    async getStatus(req, res) {
        const userId = req.userId;
        if (!userId)
            return fail(res, 401, "Authentication required");
        try {
            const status = await github_oauth_service_1.GithubOAuthService.getStatus(userId);
            return ok(res, status);
        }
        catch (err) {
            return fail(res, 500, err.message);
        }
    },
    /**
     * GitHub App installation status. Tells the frontend whether the App is
     * configured platform-side and whether an installation covers a repo.
     */
    async getAppStatus(req, res) {
        const userId = req.userId;
        if (!userId)
            return fail(res, 401, "Authentication required");
        try {
            const enabled = github_app_service_1.GithubAppService.isEnabled();
            const owner = typeof req.query.owner === "string" ? req.query.owner : undefined;
            const repo = typeof req.query.repo === "string" ? req.query.repo : undefined;
            let coversRepo;
            if (enabled && owner && repo) {
                const installation = await github_app_service_1.GithubAppService.findInstallationForRepo(owner, repo);
                coversRepo = Boolean(installation);
            }
            return ok(res, {
                enabled,
                installUrl: enabled ? github_app_service_1.GithubAppService.getInstallUrl() : null,
                coversRepo,
            });
        }
        catch (err) {
            return fail(res, 500, err.message);
        }
    },
    async listRepos(req, res) {
        const userId = req.userId;
        if (!userId)
            return fail(res, 401, "Authentication required");
        const search = typeof req.query.search === "string" ? req.query.search : undefined;
        try {
            const repos = await github_oauth_service_1.GithubOAuthService.listRepos(userId, search);
            return ok(res, repos);
        }
        catch (err) {
            if (err instanceof github_client_1.GitHubApiError && err.status === 401) {
                return fail(res, 401, "GitHub access token is invalid. Reconnect GitHub.");
            }
            if (err instanceof github_client_1.GitHubApiError && err.status === 404) {
                return fail(res, 404, "GitHub account not connected");
            }
            return fail(res, 500, err.message);
        }
    },
    // ------------------------------------------------------------------
    // Per-project repo linking
    // ------------------------------------------------------------------
    async linkRepo(req, res) {
        const userId = req.userId;
        const { projectId } = req.params;
        if (!userId)
            return fail(res, 401, "Authentication required");
        if (!mongoose_1.Types.ObjectId.isValid(projectId)) {
            return fail(res, 400, "Invalid project id");
        }
        const { owner, repo, branch } = req.body || {};
        if (typeof owner !== "string" || !owner.trim())
            return fail(res, 400, "owner is required");
        if (typeof repo !== "string" || !repo.trim())
            return fail(res, 400, "repo is required");
        const branchName = typeof branch === "string" && branch.trim() ? branch.trim() : "main";
        try {
            const updated = await project_model_1.ProjectModel.findByIdAndUpdate(projectId, {
                $set: {
                    "integrationSettings.githubRepo": {
                        owner: owner.trim(),
                        repo: repo.trim(),
                        branch: branchName,
                        linkedAt: new Date(),
                        linkedBy: new mongoose_1.Types.ObjectId(userId),
                    },
                },
            }, { new: true, projection: { integrationSettings: 1 } }).lean();
            if (!updated)
                return fail(res, 404, "Project not found");
            // Phase 7: import recent commits + releases so the feed starts populated
            void change_service_1.ChangeService.backfillProject(projectId);
            return ok(res, updated.integrationSettings?.githubRepo);
        }
        catch (err) {
            return fail(res, 500, err.message);
        }
    },
    async unlinkRepo(req, res) {
        const userId = req.userId;
        const { projectId } = req.params;
        if (!userId)
            return fail(res, 401, "Authentication required");
        if (!mongoose_1.Types.ObjectId.isValid(projectId)) {
            return fail(res, 400, "Invalid project id");
        }
        try {
            await project_model_1.ProjectModel.findByIdAndUpdate(projectId, {
                $unset: { "integrationSettings.githubRepo": "" },
            });
            return ok(res, { unlinked: true });
        }
        catch (err) {
            return fail(res, 500, err.message);
        }
    },
    /**
     * Returns the latest commits on the project's linked branch. Uses the
     * GitHub token of whoever linked the repo so the timeline keeps working
     * when other team members view the page.
     */
    async getRecentCommits(req, res) {
        const { projectId } = req.params;
        if (!mongoose_1.Types.ObjectId.isValid(projectId)) {
            return fail(res, 400, "Invalid project id");
        }
        const limitRaw = req.query.limit;
        const limit = Math.min(Math.max(Number.parseInt(typeof limitRaw === "string" ? limitRaw : "5", 10) || 5, 1), 30);
        try {
            const project = await project_model_1.ProjectModel.findById(projectId)
                .select("integrationSettings ownerId")
                .lean();
            if (!project)
                return fail(res, 404, "Project not found");
            const link = project.integrationSettings?.githubRepo;
            if (!link?.owner || !link.repo) {
                return fail(res, 404, "No GitHub repo linked to this project");
            }
            const tokenUserId = link.linkedBy?.toString() || project.ownerId?.toString();
            if (!tokenUserId) {
                return fail(res, 404, "No GitHub-connected user available for this project");
            }
            const commits = await github_oauth_service_1.GithubOAuthService.listCommits({
                userId: tokenUserId,
                owner: link.owner,
                repo: link.repo,
                branch: link.branch || "main",
                limit,
            });
            return ok(res, commits);
        }
        catch (err) {
            if (err instanceof github_client_1.GitHubApiError) {
                if (err.status === 401 || err.status === 403) {
                    return fail(res, err.status, "GitHub access denied — reconnect or check repo permissions");
                }
                if (err.status === 404) {
                    return fail(res, 404, "Linked repo not accessible from GitHub");
                }
            }
            return fail(res, 500, err.message);
        }
    },
};
