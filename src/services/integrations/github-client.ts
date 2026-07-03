/**
 * Thin wrapper around the GitHub REST API. All calls go through here so
 * authentication, rate-limit handling, and error shape are consistent.
 *
 * Tokens are accepted as opaque strings; this module never persists them.
 */

const GITHUB_API_BASE = "https://api.github.com";
const DEFAULT_TIMEOUT_MS = 10_000;

export class GitHubApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function githubApiCall<T = unknown>(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = path.startsWith("http") ? path : `${GITHUB_API_BASE}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...((init.headers as Record<string, string>) || {}),
  };
  const response = await fetchWithTimeout(url, { ...init, headers });
  if (!response.ok) {
    let body: unknown = undefined;
    try {
      body = await response.json();
    } catch {
      try {
        body = await response.text();
      } catch {
        // ignore
      }
    }
    throw new GitHubApiError(
      response.status,
      `GitHub API ${response.status}: ${path}`,
      body,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export interface GithubUser {
  id: number;
  login: string;
  name?: string;
  avatar_url?: string;
}

export interface GithubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  owner: { login: string };
  pushed_at: string;
}

export interface GithubCommit {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: { name: string; email: string; date: string };
  };
  author?: {
    login: string;
    avatar_url?: string;
  } | null;
}

/** Exchange an authorization code for a user access token. */
export async function exchangeOAuthCode(
  clientId: string,
  clientSecret: string,
  code: string,
): Promise<{ accessToken: string; scopes: string[] }> {
  const response = await fetchWithTimeout(
    "https://github.com/login/oauth/access_token",
    {
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
    },
  );
  const data = (await response.json()) as {
    access_token?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || data.error || !data.access_token) {
    throw new GitHubApiError(
      response.status,
      data.error_description || data.error || "OAuth exchange failed",
      data,
    );
  }
  return {
    accessToken: data.access_token,
    scopes: (data.scope || "").split(",").filter(Boolean),
  };
}

export async function fetchAuthenticatedUser(token: string): Promise<GithubUser> {
  return githubApiCall<GithubUser>(token, "/user");
}

/**
 * List repositories the authenticated user has access to. Defaults to recently
 * pushed-to repos so the picker surfaces "what the user is working on now."
 */
export async function listUserRepos(
  token: string,
  opts: { perPage?: number; search?: string } = {},
): Promise<GithubRepo[]> {
  const perPage = opts.perPage ?? 30;
  // /user/repos returns repos the authenticated user has access to.
  // sort=pushed surfaces recently-active repos at the top.
  const params = new URLSearchParams({
    per_page: String(perPage),
    sort: "pushed",
    direction: "desc",
    affiliation: "owner,collaborator,organization_member",
  });
  const repos = await githubApiCall<GithubRepo[]>(
    token,
    `/user/repos?${params.toString()}`,
  );
  if (!opts.search) return repos;
  const needle = opts.search.toLowerCase();
  return repos.filter(
    (r) =>
      r.full_name.toLowerCase().includes(needle) ||
      r.name.toLowerCase().includes(needle),
  );
}

export async function listRecentCommits(
  token: string,
  owner: string,
  repo: string,
  opts: { branch?: string; perPage?: number } = {},
): Promise<GithubCommit[]> {
  const params = new URLSearchParams({
    per_page: String(opts.perPage ?? 10),
  });
  if (opts.branch) params.set("sha", opts.branch);
  return githubApiCall<GithubCommit[]>(
    token,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?${params.toString()}`,
  );
}

// ---------------------------------------------------------------------------
// Change Intelligence (Phase 7) additions
// ---------------------------------------------------------------------------

export interface GithubCommitFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

export interface GithubCommitDetail extends GithubCommit {
  stats?: { additions: number; deletions: number; total: number };
  files?: GithubCommitFile[];
}

export interface GithubIssue {
  id: number;
  number: number;
  title: string;
  state: "open" | "closed";
  html_url: string;
  body?: string | null;
}

export interface GithubRelease {
  id: number;
  tag_name: string;
  name: string | null;
  html_url: string;
  published_at: string | null;
  body?: string | null;
  author?: { login: string } | null;
}

/** Fetch a single commit including per-file stats and patches. */
export async function getCommitDetail(
  token: string,
  owner: string,
  repo: string,
  sha: string,
): Promise<GithubCommitDetail> {
  return githubApiCall<GithubCommitDetail>(
    token,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(sha)}`,
  );
}

/** Compare two refs; returns the commits between them (used for suspect-commit windows). */
export async function compareCommits(
  token: string,
  owner: string,
  repo: string,
  base: string,
  head: string,
): Promise<{ commits: GithubCommit[]; files?: GithubCommitFile[] }> {
  return githubApiCall(
    token,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`,
  );
}

export async function createIssue(
  token: string,
  owner: string,
  repo: string,
  issue: { title: string; body?: string; labels?: string[] },
): Promise<GithubIssue> {
  return githubApiCall<GithubIssue>(
    token,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: issue.title,
        body: issue.body || "",
        labels: issue.labels || [],
      }),
    },
  );
}

export async function getIssue(
  token: string,
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<GithubIssue> {
  return githubApiCall<GithubIssue>(
    token,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}`,
  );
}

export async function createIssueComment(
  token: string,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
): Promise<void> {
  await githubApiCall(
    token,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}/comments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    },
  );
}

export async function listReleases(
  token: string,
  owner: string,
  repo: string,
  perPage = 20,
): Promise<GithubRelease[]> {
  return githubApiCall<GithubRelease[]>(
    token,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases?per_page=${perPage}`,
  );
}

/** List repositories accessible to an installation token. */
export async function listInstallationRepos(
  installationToken: string,
): Promise<GithubRepo[]> {
  const result = await githubApiCall<{ repositories: GithubRepo[] }>(
    installationToken,
    "/installation/repositories?per_page=100",
  );
  return result.repositories || [];
}
