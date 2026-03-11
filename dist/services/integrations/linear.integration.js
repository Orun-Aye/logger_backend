"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinearIntegration = void 0;
const base_integration_1 = require("./base.integration");
class LinearIntegration extends base_integration_1.BaseIntegration {
    type = "linear";
    displayName = "Linear";
    description = "Create Linear issues from Apperio alerts for streamlined project management and bug tracking.";
    category = "issue_tracking";
    requiredFields = ["accessToken"];
    optionalFields = ["teamId"];
    supportedActions = ["create_issue"];
    graphqlUrl = "https://api.linear.app/graphql";
    async connect(config) {
        return this.test(config);
    }
    async disconnect() {
        // No persistent connection to clean up
    }
    async test(config) {
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
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to connect to Linear: ${error.message}`,
            };
        }
    }
    async handleAction(action, payload, config) {
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
    async createIssue(payload, config) {
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
            const variables = {
                title,
                teamId,
            };
            if (description)
                variables.description = description;
            if (priority !== undefined)
                variables.priority = priority;
            if (labelIds && Array.isArray(labelIds))
                variables.labelIds = labelIds;
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
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to create Linear issue: ${error.message}`,
            };
        }
    }
}
exports.LinearIntegration = LinearIntegration;
