import {
  BaseIntegration,
  IntegrationTestResult,
  IntegrationActionResult,
} from "./base.integration";

export class GitHubIntegration extends BaseIntegration {
  readonly type = "github";
  readonly displayName = "GitHub";
  readonly description =
    "Create issues and track bugs directly in your GitHub repositories from Monita alerts.";
  readonly category = "issue_tracking" as const;
  readonly requiredFields = ["accessToken", "repo"];
  readonly optionalFields: string[] = [];
  readonly supportedActions = ["create_issue"];

  async connect(
    config: Record<string, any>
  ): Promise<IntegrationTestResult> {
    return this.test(config);
  }

  async disconnect(): Promise<void> {
    // No persistent connection to clean up for token-based auth
  }

  async test(config: Record<string, any>): Promise<IntegrationTestResult> {
    const { accessToken, repo } = config;

    if (!accessToken) {
      return { success: false, message: "Access token is required" };
    }

    try {
      // If repo is specified, verify access to that repo
      const url = repo
        ? `https://api.github.com/repos/${repo}`
        : "https://api.github.com/user";

      const response = await this.fetchWithTimeout(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          success: false,
          message: `GitHub API returned ${response.status}: ${errorBody}`,
        };
      }

      const data = await response.json();
      const name = repo ? data.full_name : data.login;

      return {
        success: true,
        message: `Successfully connected to GitHub${repo ? ` repository: ${name}` : ` as ${name}`}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to connect to GitHub: ${(error as Error).message}`,
      };
    }
  }

  async handleAction(
    action: string,
    payload: Record<string, any>,
    config: Record<string, any>
  ): Promise<IntegrationActionResult> {
    switch (action) {
      case "create_issue":
        return this.createIssue(payload, config);
      default:
        return {
          success: false,
          message: `Unsupported action: ${action}. Supported: ${this.supportedActions.join(", ")}`,
        };
    }
  }

  private async createIssue(
    payload: Record<string, any>,
    config: Record<string, any>
  ): Promise<IntegrationActionResult> {
    const { accessToken, repo } = config;
    const { title, body, labels } = payload;

    if (!accessToken || !repo) {
      return { success: false, message: "accessToken and repo are required" };
    }

    if (!title) {
      return { success: false, message: "Issue title is required" };
    }

    try {
      const response = await this.fetchWithTimeout(
        `https://api.github.com/repos/${repo}/issues`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
          body: JSON.stringify({
            title,
            body: body || "",
            labels: labels || [],
          }),
        }
      );

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          success: false,
          message: `Failed to create GitHub issue: ${response.status} ${errorBody}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data: {
          issueNumber: data.number,
          issueUrl: data.html_url,
          title: data.title,
        },
        message: `GitHub issue #${data.number} created successfully`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create GitHub issue: ${(error as Error).message}`,
      };
    }
  }
}
