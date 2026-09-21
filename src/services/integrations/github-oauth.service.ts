/**
 * GitHub integration OAuth — separate from login OAuth.
 *
 * Requests `repo` scope so the backend can read the user's repos / commits.
 * The login OAuth flow ([oauth.service.ts]) only requests profile scopes and
 * discards the token; this flow persists the token on `User.githubConnection`.
 */
import crypto from "crypto";
import { Types } from "mongoose";
import { UserModel } from "../../models/user.model";
import { GithubOAuthStateModel } from "../../models/githubOAuthState.model";
import {
  exchangeOAuthCode,
  fetchAuthenticatedUser,
  GitHubApiError,
  listRecentCommits,
  listUserRepos,
} from "./github-client";

const REQUIRED_SCOPES = ["repo", "read:user"];
const STATE_TTL_MS = 10 * 60 * 1000;

/**
 * CSRF `state` tokens live in Mongo, not process memory: the callback that
 * redeems one may be served by a different instance (or the same instance
 * after a restart) than the request that minted it. See
 * [githubOAuthState.model.ts].
 */

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

export const GithubOAuthService = {
  /**
   * Build an authorize URL the browser should redirect to. Stores a CSRF
   * `state` token mapping back to the requesting user.
   */
  async getAuthorizeUrl(opts: {
    userId: string;
    redirectUri: string;
    returnTo?: string;
  }): Promise<string> {
    const { clientId } = readEnv();
    const state = crypto.randomBytes(24).toString("hex");
    await GithubOAuthStateModel.create({
      state,
      kind: "oauth",
      userId: new Types.ObjectId(opts.userId),
      returnTo: opts.returnTo,
      expiresAt: new Date(Date.now() + STATE_TTL_MS),
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
  async completeOAuth(opts: {
    code: string;
    state: string;
  }): Promise<{ userId: string; returnTo?: string }> {
    // Single use: the delete is what enforces that, so a replayed state fails.
    const record = await GithubOAuthStateModel.findOneAndDelete({
      state: opts.state,
      kind: "oauth",
    }).lean<{ userId: Types.ObjectId; returnTo?: string; expiresAt: Date }>();
    if (!record) {
      throw new Error("OAuth state is invalid or expired");
    }
    // The TTL monitor runs about once a minute, so check explicitly.
    if (record.expiresAt && record.expiresAt.getTime() < Date.now()) {
      throw new Error("OAuth state is invalid or expired");
    }

    const { clientId, clientSecret } = readEnv();
    const { accessToken, scopes } = await exchangeOAuthCode(
      clientId,
      clientSecret,
      opts.code,
    );

    // Confirm the granted scopes contain repo read access. GitHub may strip
    // scopes the user didn't approve.
    if (!scopes.includes("repo")) {
      throw new Error(
        "GitHub did not grant `repo` scope. Reconnect and approve repository access.",
      );
    }

    const ghUser = await fetchAuthenticatedUser(accessToken);

    await UserModel.findByIdAndUpdate(
      record.userId,
      {
        $set: {
          githubConnection: {
            githubUserId: ghUser.id,
            githubLogin: ghUser.login,
            accessToken,
            scopes,
            connectedAt: new Date(),
          },
        },
      },
      { new: false },
    );

    return { userId: String(record.userId), returnTo: record.returnTo };
  },

  async disconnect(userId: string): Promise<void> {
    if (!Types.ObjectId.isValid(userId)) return;
    await UserModel.findByIdAndUpdate(userId, {
      $unset: { githubConnection: "" },
    });
  },

  async getStatus(userId: string): Promise<{
    connected: boolean;
    githubLogin?: string;
    githubUserId?: number;
    connectedAt?: Date;
  }> {
    if (!Types.ObjectId.isValid(userId)) return { connected: false };
    // Read with the token so we can verify presence; never return it.
    const user = await UserModel.findById(userId)
      .select("+githubConnection")
      .lean();
    const conn = (user as any)?.githubConnection;
    if (!conn) return { connected: false };
    return {
      connected: true,
      githubLogin: conn.githubLogin,
      githubUserId: conn.githubUserId,
      connectedAt: conn.connectedAt,
    };
  },

  async listRepos(
    userId: string,
    search?: string,
  ): Promise<
    Array<{
      owner: string;
      repo: string;
      fullName: string;
      defaultBranch: string;
      private: boolean;
    }>
  > {
    const token = await this.getTokenForUser(userId);
    const repos = await listUserRepos(token, { search, perPage: 50 });
    return repos.map((r) => ({
      owner: r.owner.login,
      repo: r.name,
      fullName: r.full_name,
      defaultBranch: r.default_branch || "main",
      private: r.private,
    }));
  },

  async listCommits(opts: {
    userId: string;
    owner: string;
    repo: string;
    branch: string;
    limit: number;
  }) {
    const token = await this.getTokenForUser(opts.userId);
    const commits = await listRecentCommits(token, opts.owner, opts.repo, {
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
  async getTokenForUser(userId: string): Promise<string> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid user id");
    }
    const user = await UserModel.findById(userId)
      .select("+githubConnection")
      .lean();
    const conn = (user as any)?.githubConnection;
    if (!conn?.accessToken) {
      throw new GitHubApiError(404, "User has no connected GitHub account");
    }
    return conn.accessToken;
  },
};
