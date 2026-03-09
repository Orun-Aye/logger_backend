import {
  BaseIntegration,
  IntegrationTestResult,
  IntegrationActionResult,
} from "./base.integration";

export class PagerDutyIntegration extends BaseIntegration {
  readonly type = "pagerduty";
  readonly displayName = "PagerDuty";
  readonly description =
    "Trigger and resolve PagerDuty incidents automatically from Apperio alerts for on-call management.";
  readonly category = "incident_management" as const;
  readonly requiredFields = ["accessToken"];
  readonly optionalFields = ["serviceId"];
  readonly supportedActions = ["trigger_incident", "resolve_incident"];

  private readonly eventsApiUrl = "https://events.pagerduty.com/v2/enqueue";

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
      return {
        success: false,
        message: "Integration key (routing key) is required",
      };
    }

    try {
      // Send a trigger event and then immediately resolve it
      const dedupKey = `apperio-test-${Date.now()}`;

      // Trigger test event
      const triggerResponse = await this.fetchWithTimeout(this.eventsApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routing_key: accessToken,
          event_action: "trigger",
          dedup_key: dedupKey,
          payload: {
            summary: "Apperio integration test - this will auto-resolve",
            severity: "info",
            source: "apperio",
            component: "integration-test",
          },
        }),
      });

      if (!triggerResponse.ok) {
        const errorBody = await triggerResponse.text();
        return {
          success: false,
          message: `PagerDuty API returned ${triggerResponse.status}: ${errorBody}`,
        };
      }

      // Immediately resolve the test event
      await this.fetchWithTimeout(this.eventsApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routing_key: accessToken,
          event_action: "resolve",
          dedup_key: dedupKey,
        }),
      });

      return {
        success: true,
        message: "Successfully connected to PagerDuty. Test event triggered and resolved.",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to connect to PagerDuty: ${(error as Error).message}`,
      };
    }
  }

  async handleAction(
    action: string,
    payload: Record<string, any>,
    config: Record<string, any>
  ): Promise<IntegrationActionResult> {
    switch (action) {
      case "trigger_incident":
        return this.triggerIncident(payload, config);
      case "resolve_incident":
        return this.resolveIncident(payload, config);
      default:
        return {
          success: false,
          message: `Unsupported action: ${action}. Supported: ${this.supportedActions.join(", ")}`,
        };
    }
  }

  private async triggerIncident(
    payload: Record<string, any>,
    config: Record<string, any>
  ): Promise<IntegrationActionResult> {
    const { accessToken } = config;
    const { summary, severity, source, dedupKey, details } = payload;

    if (!accessToken) {
      return { success: false, message: "Integration key is required" };
    }

    if (!summary) {
      return { success: false, message: "Incident summary is required" };
    }

    try {
      const body: Record<string, any> = {
        routing_key: accessToken,
        event_action: "trigger",
        payload: {
          summary,
          severity: severity || "error",
          source: source || "apperio",
          custom_details: details || {},
        },
      };

      if (dedupKey) {
        body.dedup_key = dedupKey;
      }

      const response = await this.fetchWithTimeout(this.eventsApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          success: false,
          message: `Failed to trigger PagerDuty incident: ${response.status} ${errorBody}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data: {
          dedupKey: data.dedup_key,
          status: data.status,
          message: data.message,
        },
        message: "PagerDuty incident triggered successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to trigger PagerDuty incident: ${(error as Error).message}`,
      };
    }
  }

  private async resolveIncident(
    payload: Record<string, any>,
    config: Record<string, any>
  ): Promise<IntegrationActionResult> {
    const { accessToken } = config;
    const { dedupKey } = payload;

    if (!accessToken) {
      return { success: false, message: "Integration key is required" };
    }

    if (!dedupKey) {
      return { success: false, message: "Dedup key is required to resolve an incident" };
    }

    try {
      const response = await this.fetchWithTimeout(this.eventsApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routing_key: accessToken,
          event_action: "resolve",
          dedup_key: dedupKey,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          success: false,
          message: `Failed to resolve PagerDuty incident: ${response.status} ${errorBody}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data: {
          dedupKey: data.dedup_key,
          status: data.status,
        },
        message: "PagerDuty incident resolved successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to resolve PagerDuty incident: ${(error as Error).message}`,
      };
    }
  }
}
