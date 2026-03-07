/**
 * Base class for all third-party integrations.
 * Each integration provider must implement these abstract methods.
 */
export interface IntegrationTestResult {
  success: boolean;
  message: string;
}

export interface IntegrationActionResult {
  success: boolean;
  data?: any;
  message?: string;
}

export abstract class BaseIntegration {
  abstract readonly type: string;
  abstract readonly displayName: string;
  abstract readonly description: string;
  abstract readonly category: "issue_tracking" | "incident_management" | "communication";

  /**
   * List of required config fields for connecting this integration.
   */
  abstract readonly requiredFields: string[];

  /**
   * List of optional config fields.
   */
  abstract readonly optionalFields: string[];

  /**
   * Supported actions this integration can perform.
   */
  abstract readonly supportedActions: string[];

  /**
   * Validate and connect the integration using provided config.
   * Should verify that credentials are valid.
   */
  abstract connect(config: Record<string, any>): Promise<IntegrationTestResult>;

  /**
   * Disconnect / clean up resources for an integration.
   */
  abstract disconnect(): Promise<void>;

  /**
   * Test that the integration is still working.
   */
  abstract test(config: Record<string, any>): Promise<IntegrationTestResult>;

  /**
   * Execute an action (e.g. create_issue, send_notification).
   */
  abstract handleAction(
    action: string,
    payload: Record<string, any>,
    config: Record<string, any>
  ): Promise<IntegrationActionResult>;

  /**
   * Helper: make an HTTP request with timeout.
   */
  protected async fetchWithTimeout(
    url: string,
    options: RequestInit & { timeout?: number } = {}
  ): Promise<Response> {
    const { timeout = 15000, ...fetchOptions } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(id);
    }
  }
}
