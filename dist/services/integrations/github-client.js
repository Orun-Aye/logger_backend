"use strict";
/**
 * Thin wrapper around the GitHub REST API. All calls go through here so
 * authentication, rate-limit handling, and error shape are consistent.
 *
 * Tokens are accepted as opaque strings; this module never persists them.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubApiError = void 0;
exports.githubApiCall = githubApiCall;
exports.exchangeOAuthCode = exchangeOAuthCode;
exports.fetchAuthenticatedUser = fetchAuthenticatedUser;
exports.listUserRepos = listUserRepos;
exports.listRecentCommits = listRecentCommits;
exports.getCommitDetail = getCommitDetail;
exports.compareCommits = compareCommits;
exports.createIssue = createIssue;
exports.getIssue = getIssue;
exports.createIssueComment = createIssueComment;
exports.listReleases = listReleases;
exports.listInstallationRepos = listInstallationRepos;
const GITHUB_API_BASE = "https://api.github.com";
const DEFAULT_TIMEOUT_MS = 10_000;
class GitHubApiError extends Error {
    status;
    body;
    constructor(status, message, body) {
        super(message);
        this.status = status;
        this.body = body;
        this.name = "GitHubApiError";
    }
}
exports.GitHubApiError = GitHubApiError;
async function fetchWithTimeout(url, init, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    }
    finally {
        clearTimeout(timer);
    }
}
async function githubApiCall(token, path, init = {}) {
    const url = path.startsWith("http") ? path : `${GITHUB_API_BASE}${path}`;
    const headers = {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(init.headers || {}),
    };
    const response = await fetchWithTimeout(url, { ...init, headers });
    if (!response.ok) {
        let body = undefined;
        try {
            body = await response.json();
        }
        catch {
            try {
                body = await response.text();
            }
            catch {
                // ignore
            }
        }
        throw new GitHubApiError(response.status, `GitHub API ${response.status}: ${path}`, body);
    }
    if (response.status === 204)
        return undefined;
    return (await response.json());
}
/** Exchange an authorization code for a user access token. */
async function exchangeOAuthCode(clientId, clientSecret, code) {
    const response = await fetchWithTimeout("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            code,
        }),
    });
    const data = (await response.json());
    if (!response.ok || data.error || !data.access_token) {
        throw new GitHubApiError(response.status, data.error_description || data.error || "OAuth exchange failed", data);
    }
    return {
        accessToken: data.access_token,
        scopes: (data.scope || "").split(",").filter(Boolean),
    };
}
async function fetchAuthenticatedUser(token) {
    return githubApiCall(token, "/user");
}
/**
 * List repositories the authenticated user has access to. Defaults to recently
 * pushed-to repos so the picker surfaces "what the user is working on now."
 */
async function listUserRepos(token, opts = {}) {
    const perPage = opts.perPage ?? 30;
    // /user/repos returns repos the authenticated user has access to.
    // sort=pushed surfaces recently-active repos at the top.
    const params = new URLSearchParams({
        per_page: String(perPage),
        sort: "pushed",
        direction: "desc",
        affiliation: "owner,collaborator,organization_member",
    });
    const repos = await githubApiCall(token, `/user/repos?${params.toString()}`);
    if (!opts.search)
        return repos;
    const needle = opts.search.toLowerCase();
    return repos.filter((r) => r.full_name.toLowerCase().includes(needle) ||
        r.name.toLowerCase().includes(needle));
}
async function listRecentCommits(token, owner, repo, opts = {}) {
    const params = new URLSearchParams({
        per_page: String(opts.perPage ?? 10),
    });
    if (opts.branch)
        params.set("sha", opts.branch);
    return githubApiCall(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?${params.toString()}`);
}
/** Fetch a single commit including per-file stats and patches. */
async function getCommitDetail(token, owner, repo, sha) {
    return githubApiCall(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(sha)}`);
}
/** Compare two refs; returns the commits between them (used for suspect-commit windows). */
async function compareCommits(token, owner, repo, base, head) {
    return githubApiCall(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`);
}
async function createIssue(token, owner, repo, issue) {
    return githubApiCall(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            title: issue.title,
            body: issue.body || "",
            labels: issue.labels || [],
        }),
    });
}
async function getIssue(token, owner, repo, issueNumber) {
    return githubApiCall(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}`);
}
async function createIssueComment(token, owner, repo, issueNumber, body) {
    await githubApiCall(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
    });
}
async function listReleases(token, owner, repo, perPage = 20) {
    return githubApiCall(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases?per_page=${perPage}`);
}
/** List repositories accessible to an installation token. */
async function listInstallationRepos(installationToken) {
    const result = await githubApiCall(installationToken, "/installation/repositories?per_page=100");
    return result.repositories || [];
}
