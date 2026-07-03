"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GithubOAuthService = void 0;
/**
 * GitHub integration OAuth — separate from login OAuth.
 *
 * Requests `repo` scope so the backend can read the user's repos / commits.
 * The login OAuth flow ([oauth.service.ts]) only requests profile scopes and
 * discards the token; this flow persists the token on `User.githubConnection`.
 */
const crypto_1 = __importDefault(require("crypto"));
const mongoose_1 = require("mongoose");
const user_model_1 = require("../../models/user.model");
const github_client_1 = require("./github-client");
const REQUIRED_SCOPES = ["repo", "read:user"];
const STATE_TTL_MS = 10 * 60 * 1000;
/** In-memory state store (CSRF token → userId). Sufficient for a single-node
 * deploy; if Apperio scales to multiple instances this should move to Redis. */
const stateStore = new Map();
function pruneExpired() {
    const now = Date.now();
    for (const [k, v] of stateStore.entries()) {
        if (v.expiresAt < now)
            stateStore.delete(k);
    }
}
function readEnv() {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    // The redirect URI must be registered with the GitHub OAuth app. Falls back
    // to GITHUB_OAUTH_REDIRECT_URI if set; otherwise built from the request host
    // by the route handler.
    const redirectUri = process.env.GITHUB_INTEGRATION_REDIRECT_URI;
    if (!clientId || !clientSecret) {
        throw new Error("GitHub OAuth client credentials are not configured");
    }
    return { clientId, clientSecret, redirectUri };
}
exports.GithubOAuthService = {
    /**
     * Build an authorize URL the browser should redirect to. Stores a CSRF
     * `state` token mapping back to the requesting user.
     */
    getAuthorizeUrl(opts) {
        const { clientId } = readEnv();
        pruneExpired();
        const state = crypto_1.default.randomBytes(24).toString("hex");
        stateStore.set(state, {
            userId: opts.userId,
            returnTo: opts.returnTo,
            expiresAt: Date.now() + STATE_TTL_MS,
        });
        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: opts.redirectUri,
            scope: REQUIRED_SCOPES.join(" "),
            state,
            allow_signup: "false",
        });
        return `https://github.com/login/oauth/authorize?${params.toString()}`;
    },
    /**
     * Handle the OAuth callback — validate state, exchange code, persist token.
     * Returns the optional `returnTo` URL the user should be redirected to.
     */
    async completeOAuth(opts) {
        pruneExpired();
        const record = stateStore.get(opts.state);
        if (!record) {
            throw new Error("OAuth state is invalid or expired");
        }
        stateStore.delete(opts.state);
        const { clientId, clientSecret } = readEnv();
        const { accessToken, scopes } = await (0, github_client_1.exchangeOAuthCode)(clientId, clientSecret, opts.code);
        // Confirm the granted scopes contain repo read access. GitHub may strip
        // scopes the user didn't approve.
        if (!scopes.includes("repo")) {
            throw new Error("GitHub did not grant `repo` scope. Reconnect and approve repository access.");
        }
        const ghUser = await (0, github_client_1.fetchAuthenticatedUser)(accessToken);
        await user_model_1.UserModel.findByIdAndUpdate(record.userId, {
            $set: {
                githubConnection: {
                    githubUserId: ghUser.id,
                    githubLogin: ghUser.login,
                    accessToken,
                    scopes,
                    connectedAt: new Date(),
                },
            },
        }, { new: false });
        return { userId: record.userId, returnTo: record.returnTo };
    },
    async disconnect(userId) {
        if (!mongoose_1.Types.ObjectId.isValid(userId))
            return;
        await user_model_1.UserModel.findByIdAndUpdate(userId, {
            $unset: { githubConnection: "" },
        });
    },
    async getStatus(userId) {
        if (!mongoose_1.Types.ObjectId.isValid(userId))
            return { connected: false };
        // Read with the token so we can verify presence; never return it.
        const user = await user_model_1.UserModel.findById(userId)
            .select("+githubConnection")
            .lean();
        const conn = user?.githubConnection;
        if (!conn)
            return { connected: false };
        return {
            connected: true,
            githubLogin: conn.githubLogin,
            githubUserId: conn.githubUserId,
            connectedAt: conn.connectedAt,
        };
    },
    async listRepos(userId, search) {
        const token = await this.getTokenForUser(userId);
        const repos = await (0, github_client_1.listUserRepos)(token, { search, perPage: 50 });
        return repos.map((r) => ({
            owner: r.owner.login,
            repo: r.name,
            fullName: r.full_name,
            defaultBranch: r.default_branch || "main",
            private: r.private,
        }));
    },
    async listCommits(opts) {
        const token = await this.getTokenForUser(opts.userId);
        const commits = await (0, github_client_1.listRecentCommits)(token, opts.owner, opts.repo, {
            branch: opts.branch,
            perPage: opts.limit,
        });
        return commits.map((c) => ({
            sha: c.sha,
            message: c.commit.message,
            url: c.html_url,
            branch: opts.branch,
            committedAt: c.commit.author.date,
            author: {
                login: c.author?.login || c.commit.author.email.split("@")[0],
                name: c.commit.author.name,
                avatar: c.author?.avatar_url,
            },
        }));
    },
    /**
     * Fetch the stored access token for a user. Throws if not connected.
     * Token never leaves this service.
     */
    async getTokenForUser(userId) {
        if (!mongoose_1.Types.ObjectId.isValid(userId)) {
            throw new Error("Invalid user id");
        }
        const user = await user_model_1.UserModel.findById(userId)
            .select("+githubConnection")
            .lean();
        const conn = user?.githubConnection;
        if (!conn?.accessToken) {
            throw new github_client_1.GitHubApiError(404, "User has no connected GitHub account");
        }
        return conn.accessToken;
    },
};
