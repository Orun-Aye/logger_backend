import {
  BaseIntegration,
  IntegrationTestResult,
  IntegrationActionResult,
} from "./base.integration";

export class JiraIntegration extends BaseIntegration {
  readonly type = "jira";
  readonly displayName = "Jira";
  readonly description =
    "Create Jira tickets automatically from Monita alerts and errors for seamless issue tracking.";
  readonly category = "issue_tracking" as const;
  readonly requiredFields = ["accessToken", "baseUrl", "email", "project"];
  readonly optionalFields: string[] = [];
  readonly supportedActions = ["create_ticket"];

  async connect(
    config: Record<string, any>
  ): Promise<IntegrationTestResult> {
    return this.test(config);
  }

  async disconnect(): Promise<void> {
    // No persistent connection to clean up
  }

  async test(config: Record<string, any>): Promise<IntegrationTestResult> {
    const { accessToken, baseUrl, email } = config;

    if (!accessToken || !baseUrl || !email) {
      return {
        success: false,
        message: "API token, base URL, and email are required",
      };
    }

    try {
      const normalizedUrl = baseUrl.replace(/\/+$/, "");
      const authString = Buffer.from(`${email}:${accessToken}`).toString(
        "base64"
      );

      const response = await this.fetchWithTimeout(
        `${normalizedUrl}/rest/api/3/myself`,
        {
          headers: {
            Authorization: `Basic ${authString}`,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          success: false,
          message: `Jira API returned ${response.status}: ${errorBody}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        message: `Successfully connected to Jira as ${data.displayName || data.emailAddress}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to connect to Jira: ${(error as Error).message}`,
      };
    }
  }

  async handleAction(
    action: string,
    payload: Record<string, any>,
    config: Record<string, any>
  ): Promise<IntegrationActionResult> {
    switch (action) {
      case "create_ticket":
        return this.createTicket(payload, config);
      default:
        return {
          success: false,
          message: `Unsupported action: ${action}. Supported: ${this.supportedActions.join(", ")}`,
        };
    }
  }

  private async createTicket(
    payload: Record<string, any>,
    config: Record<string, any>
  ): Promise<IntegrationActionResult> {
    const { accessToken, baseUrl, email, project } = config;
    const { summary, description, issuetype, priority } = payload;

    if (!accessToken || !baseUrl || !email || !project) {
      return {
        success: false,
        message: "accessToken, baseUrl, email, and project are required",
      };
    }

    if (!summary) {
      return { success: false, message: "Ticket summary is required" };
    }

    try {
      const normalizedUrl = baseUrl.replace(/\/+$/, "");
      const authString = Buffer.from(`${email}:${accessToken}`).toString(
        "base64"
      );

      const issueData: Record<string, any> = {
        fields: {
          project: { key: project },
          summary,
          issuetype: { name: issuetype || "Bug" },
        },
      };

      if (description) {
        issueData.fields.description = {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: description }],
            },
          ],
        };
      }

      if (priority) {
        issueData.fields.priority = { name: priority };
      }

      const response = await this.fetchWithTimeout(
        `${normalizedUrl}/rest/api/3/issue`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${authString}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(issueData),
        }
      );

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          success: false,
          message: `Failed to create Jira ticket: ${response.status} ${errorBody}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data: {
          ticketKey: data.key,
          ticketId: data.id,
          ticketUrl: `${normalizedUrl}/browse/${data.key}`,
        },
        message: `Jira ticket ${data.key} created successfully`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create Jira ticket: ${(error as Error).message}`,
      };
    }
  }
}
