import {
  BaseIntegration,
  IntegrationTestResult,
  IntegrationActionResult,
} from "./base.integration";

export class MicrosoftTeamsIntegration extends BaseIntegration {
  readonly type = "teams";
  readonly displayName = "Microsoft Teams";
  readonly description =
    "Send alert notifications and incident reports to Microsoft Teams channels via incoming webhooks.";
  readonly category = "communication" as const;
  readonly requiredFields = ["webhookUrl"];
  readonly optionalFields: string[] = [];
  readonly supportedActions = ["send_notification"];

  async connect(
    config: Record<string, any>
  ): Promise<IntegrationTestResult> {
    return this.test(config);
  }

  async disconnect(): Promise<void> {
    // No persistent connection to clean up
  }

  async test(config: Record<string, any>): Promise<IntegrationTestResult> {
    const { webhookUrl } = config;

    if (!webhookUrl) {
      return { success: false, message: "Webhook URL is required" };
    }

    try {
      // Send a test adaptive card
      const card = this.buildAdaptiveCard({
        title: "Apperio Integration Test",
        description:
          "This is a test message from Apperio. Your Microsoft Teams integration is working correctly.",
        level: "info",
        facts: [
          { title: "Status", value: "Connected" },
          { title: "Time", value: new Date().toISOString() },
        ],
      });

      const response = await this.fetchWithTimeout(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(card),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          success: false,
          message: `Teams webhook returned ${response.status}: ${errorBody}`,
        };
      }

      return {
        success: true,
        message: "Successfully connected to Microsoft Teams. Test message sent.",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to connect to Microsoft Teams: ${(error as Error).message}`,
      };
    }
  }

  async handleAction(
    action: string,
    payload: Record<string, any>,
    config: Record<string, any>
  ): Promise<IntegrationActionResult> {
    switch (action) {
      case "send_notification":
        return this.sendNotification(payload, config);
      default:
        return {
          success: false,
          message: `Unsupported action: ${action}. Supported: ${this.supportedActions.join(", ")}`,
        };
    }
  }

  private async sendNotification(
    payload: Record<string, any>,
    config: Record<string, any>
  ): Promise<IntegrationActionResult> {
    const { webhookUrl } = config;
    const { title, description, level, project, facts } = payload;

    if (!webhookUrl) {
      return { success: false, message: "Webhook URL is required" };
    }

    const card = this.buildAdaptiveCard({
      title: title || "Apperio Alert",
      description: description || "",
      level: level || "info",
      project,
      facts,
    });

    try {
      const response = await this.fetchWithTimeout(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(card),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          success: false,
          message: `Teams webhook failed: ${response.status} ${errorBody}`,
        };
      }

      return {
        success: true,
        message: "Notification sent to Microsoft Teams successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to send Teams notification: ${(error as Error).message}`,
      };
    }
  }

  private buildAdaptiveCard(params: {
    title: string;
    description: string;
    level?: string;
    project?: string;
    facts?: Array<{ title: string; value: string }>;
  }): Record<string, any> {
    const colorMap: Record<string, string> = {
      error: "attention",
      fatal: "attention",
      warn: "warning",
      info: "accent",
      debug: "default",
      trace: "default",
    };

    const body: any[] = [
      {
        type: "TextBlock",
        text: params.title,
        weight: "bolder",
        size: "medium",
        color: colorMap[params.level || "info"] || "accent",
      },
    ];

    if (params.project) {
      body.push({
        type: "TextBlock",
        text: `Project: ${params.project}`,
        isSubtle: true,
        spacing: "none",
      });
    }

    if (params.description) {
      body.push({
        type: "TextBlock",
        text: params.description,
        wrap: true,
        spacing: "small",
      });
    }

    if (params.facts && params.facts.length > 0) {
      body.push({
        type: "FactSet",
        facts: params.facts.map((f) => ({
          title: f.title,
          value: f.value,
        })),
      });
    }

    body.push({
      type: "TextBlock",
      text: `Sent by Apperio at ${new Date().toISOString()}`,
      isSubtle: true,
      size: "small",
      spacing: "medium",
    });

    return {
      type: "message",
      attachments: [
        {
          contentType: "application/vnd.microsoft.card.adaptive",
          content: {
            $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
            type: "AdaptiveCard",
            version: "1.4",
            body,
          },
        },
      ],
    };
  }
}
