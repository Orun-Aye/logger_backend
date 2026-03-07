import {
  BaseIntegration,
  IntegrationTestResult,
  IntegrationActionResult,
} from "./base.integration";

export class LinearIntegration extends BaseIntegration {
  readonly type = "linear";
  readonly displayName = "Linear";
  readonly description =
    "Create Linear issues from Monita alerts for streamlined project management and bug tracking.";
  readonly category = "issue_tracking" as const;
  readonly requiredFields = ["accessToken"];
  readonly optionalFields = ["teamId"];
  readonly supportedActions = ["create_issue"];

  private readonly graphqlUrl = "https://api.linear.app/graphql";

  async connect(
    config: Record<string, any>
  ): Promise<IntegrationTestResult> {
    return this.test(config);
  }

  async disconnect(): Promise<void> {
    // No persistent connection to clean up
  }

  async test(config: Record<string, any>): Promise<IntegrationTestResult> {
    const { accessToken } = config;

    if (!accessToken) {
      return { success: false, message: "API key is required" };
    }

    try {
      const response = await this.fetchWithTimeout(this.graphqlUrl, {
        method: "POST",
        headers: {
          Authorization: accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `{ viewer { id name email } }`,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          success: false,
          message: `Linear API returned ${response.status}: ${errorBody}`,
        };
      }

      const data = await response.json();
      if (data.errors) {
        return {
          success: false,
          message: `Linear API error: ${data.errors[0]?.message || "Unknown error"}`,
        };
      }

      const viewer = data.data?.viewer;
      return {
        success: true,
        message: `Successfully connected to Linear as ${viewer?.name || viewer?.email || "user"}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to connect to Linear: ${(error as Error).message}`,
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
    const { accessToken, teamId: configTeamId } = config;
    const { title, description, teamId: payloadTeamId, priority, labelIds } = payload;

    if (!accessToken) {
      return { success: false, message: "API key is required" };
    }

    if (!title) {
      return { success: false, message: "Issue title is required" };
    }

    const teamId = payloadTeamId || configTeamId;
    if (!teamId) {
      return {
        success: false,
        message: "Team ID is required. Provide it in the integration config or action payload.",
      };
    }

    try {
      const variables: Record<string, any> = {
        title,
        teamId,
      };

      if (description) variables.description = description;
      if (priority !== undefined) variables.priority = priority;
      if (labelIds && Array.isArray(labelIds)) variables.labelIds = labelIds;

      const mutation = `
        mutation CreateIssue($title: String!, $teamId: String!, $description: String, $priority: Int, $labelIds: [String!]) {
          issueCreate(input: {
            title: $title
            teamId: $teamId
            description: $description
            priority: $priority
            labelIds: $labelIds
          }) {
            success
            issue {
              id
              identifier
              title
              url
            }
          }
        }
      `;

      const response = await this.fetchWithTimeout(this.graphqlUrl, {
        method: "POST",
        headers: {
          Authorization: accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: mutation, variables }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          success: false,
          message: `Linear API failed: ${response.status} ${errorBody}`,
        };
      }

      const data = await response.json();
      if (data.errors) {
        return {
          success: false,
          message: `Linear GraphQL error: ${data.errors[0]?.message || "Unknown error"}`,
        };
      }

      const result = data.data?.issueCreate;
      if (!result?.success) {
        return { success: false, message: "Failed to create Linear issue" };
      }

      return {
        success: true,
        data: {
          issueId: result.issue.id,
          identifier: result.issue.identifier,
          issueUrl: result.issue.url,
          title: result.issue.title,
        },
        message: `Linear issue ${result.issue.identifier} created successfully`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create Linear issue: ${(error as Error).message}`,
      };
    }
  }
}
