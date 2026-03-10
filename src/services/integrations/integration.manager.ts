import mongoose from "mongoose";
import {
  IntegrationModel,
  IIntegration,
  IntegrationType,
} from "../../models/integration.model";
import { BaseIntegration } from "./base.integration";
import { GitHubIntegration } from "./github.integration";
import { JiraIntegration } from "./jira.integration";
import { PagerDutyIntegration } from "./pagerduty.integration";
import { DiscordIntegration } from "./discord.integration";
import { MicrosoftTeamsIntegration } from "./microsoft-teams.integration";
import { LinearIntegration } from "./linear.integration";

export interface IntegrationTypeInfo {
  type: string;
  displayName: string;
  description: string;
  category: "issue_tracking" | "incident_management" | "communication";
  requiredFields: string[];
  optionalFields: string[];
  supportedActions: string[];
}

class IntegrationManager {
  private registry: Map<string, BaseIntegration> = new Map();

  constructor() {
    this.registerIntegration(new GitHubIntegration());
    this.registerIntegration(new JiraIntegration());
    this.registerIntegration(new PagerDutyIntegration());
    this.registerIntegration(new DiscordIntegration());
    this.registerIntegration(new MicrosoftTeamsIntegration());
    this.registerIntegration(new LinearIntegration());
  }

  private registerIntegration(integration: BaseIntegration): void {
    this.registry.set(integration.type, integration);
  }

  /**
   * List all available integration types with setup info.
   */
  getAvailableIntegrations(): IntegrationTypeInfo[] {
    const integrations: IntegrationTypeInfo[] = [];
    this.registry.forEach((integration) => {
      integrations.push({
        type: integration.type,
        displayName: integration.displayName,
        description: integration.description,
        category: integration.category,
        requiredFields: integration.requiredFields,
        optionalFields: integration.optionalFields,
        supportedActions: integration.supportedActions,
      });
    });
    return integrations;
  }

  /**
   * Get all connected integrations for a user, optionally filtered by project.
   */
  async getConnectedIntegrations(
    userId: string,
    projectId?: string
  ): Promise<IIntegration[]> {
    const filter: Record<string, any> = { createdBy: userId };
    if (projectId) {
      filter.$or = [
        { projectId: new mongoose.Types.ObjectId(projectId) },
        { projectId: { $exists: false } },
        { projectId: null },
      ];
    }

    return IntegrationModel.find(filter)
      .select("-config.accessToken -config.refreshToken")
      .sort({ updatedAt: -1 })
      .lean();
  }

  /**
   * Connect a new integration.
   */
  async connectIntegration(
    userId: string,
    type: string,
    config: Record<string, any>,
    projectId?: string,
    organizationId?: string
  ): Promise<IIntegration> {
    const integration = this.registry.get(type);
    if (!integration) {
      throw new Error(
        `Unknown integration type: ${type}. Available: ${Array.from(this.registry.keys()).join(", ")}`
      );
    }

    // Validate required fields
    for (const field of integration.requiredFields) {
      if (!config[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Test connection before saving
    const testResult = await integration.connect(config);
    if (!testResult.success) {
      throw new Error(`Connection failed: ${testResult.message}`);
    }

    // Check if an integration of this type already exists for this user/project
    const existingFilter: Record<string, any> = {
      createdBy: userId,
      type,
    };
    if (projectId) {
      existingFilter.projectId = new mongoose.Types.ObjectId(projectId);
    } else {
      existingFilter.$or = [
        { projectId: { $exists: false } },
        { projectId: null },
      ];
    }

    const existing = await IntegrationModel.findOne(existingFilter);
    if (existing) {
      // Update existing integration
      existing.config = config as any;
      existing.status = "connected";
      existing.metadata.lastSyncAt = new Date();
      existing.metadata.syncErrors = [];
      if (organizationId) {
        existing.organizationId = new mongoose.Types.ObjectId(organizationId);
      }
      await existing.save();
      return existing;
    }

    // Create new integration
    const newIntegration = new IntegrationModel({
      type: type as IntegrationType,
      status: "connected",
      config,
      metadata: {
        lastSyncAt: new Date(),
        syncErrors: [],
      },
      createdBy: new mongoose.Types.ObjectId(userId),
      ...(projectId && {
        projectId: new mongoose.Types.ObjectId(projectId),
      }),
      ...(organizationId && {
        organizationId: new mongoose.Types.ObjectId(organizationId),
      }),
    });

    await newIntegration.save();
    return newIntegration;
  }

  /**
   * Disconnect (remove) an integration.
   */
  async disconnectIntegration(
    integrationId: string,
    userId: string
  ): Promise<void> {
    const doc = await IntegrationModel.findOne({
      _id: integrationId,
      createdBy: userId,
    });

    if (!doc) {
      throw new Error("Integration not found or access denied");
    }

    const integration = this.registry.get(doc.type);
    if (integration) {
      await integration.disconnect();
    }

    await IntegrationModel.deleteOne({ _id: integrationId });
  }

  /**
   * Test an existing integration's connection.
   */
  async testIntegration(
    integrationId: string,
    userId: string
  ): Promise<{ success: boolean; message: string }> {
    const doc = await IntegrationModel.findOne({
      _id: integrationId,
      createdBy: userId,
    });

    if (!doc) {
      throw new Error("Integration not found or access denied");
    }

    const integration = this.registry.get(doc.type);
    if (!integration) {
      throw new Error(`Integration type "${doc.type}" not found in registry`);
    }

    const result = await integration.test(doc.config as Record<string, any>);

    // Update status based on test result
    doc.status = result.success ? "connected" : "error";
    doc.metadata.lastSyncAt = new Date();
    if (!result.success) {
      doc.metadata.syncErrors = [
        ...(doc.metadata.syncErrors || []).slice(-9),
        result.message,
      ];
    } else {
      doc.metadata.syncErrors = [];
    }
    await doc.save();

    return result;
  }

  /**
   * Execute an action on a connected integration.
   */
  async executeAction(
    integrationId: string,
    userId: string,
    action: string,
    payload: Record<string, any>
  ): Promise<any> {
    const doc = await IntegrationModel.findOne({
      _id: integrationId,
      createdBy: userId,
    });

    if (!doc) {
      throw new Error("Integration not found or access denied");
    }

    if (doc.status !== "connected") {
      throw new Error(
        `Integration is not connected (current status: ${doc.status})`
      );
    }

    const integration = this.registry.get(doc.type);
    if (!integration) {
      throw new Error(`Integration type "${doc.type}" not found in registry`);
    }

    const result = await integration.handleAction(
      action,
      payload,
      doc.config as Record<string, any>
    );

    // Update lastSyncAt
    doc.metadata.lastSyncAt = new Date();
    if (!result.success) {
      doc.metadata.syncErrors = [
        ...(doc.metadata.syncErrors || []).slice(-9),
        result.message || "Action failed",
      ];
    }
    await doc.save();

    return result;
  }

  /**
   * Execute an action for a project without requiring userId.
   * Used by server-side processes like alert notifications.
   */
  async executeActionForProject(
    projectId: string,
    integrationType: string,
    action: string,
    payload: Record<string, any>
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      const doc = await IntegrationModel.findOne({
        projectId: new mongoose.Types.ObjectId(projectId),
        type: integrationType,
        status: "connected",
      });

      if (!doc) {
        return {
          success: false,
          error: `No connected ${integrationType} integration found for project ${projectId}`,
        };
      }

      const handler = this.registry.get(doc.type);
      if (!handler) {
        return {
          success: false,
          error: `Integration type "${doc.type}" not found in registry`,
        };
      }

      const result = await handler.handleAction(
        action,
        payload,
        doc.config as Record<string, any>
      );

      // Update lastSyncAt
      doc.metadata.lastSyncAt = new Date();
      if (!result.success) {
        doc.metadata.syncErrors = [
          ...(doc.metadata.syncErrors || []).slice(-9),
          result.message || "Action failed",
        ];
      }
      await doc.save();

      return {
        success: result.success,
        result: result.data,
        error: result.success ? undefined : result.message,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `executeActionForProject failed: ${error.message}`,
      };
    }
  }

  /**
   * Get a single integration by ID (for detail views).
   */
  async getIntegrationById(
    integrationId: string,
    userId: string
  ): Promise<IIntegration | null> {
    return IntegrationModel.findOne({
      _id: integrationId,
      createdBy: userId,
    })
      .select("-config.accessToken -config.refreshToken")
      .lean();
  }

  /**
   * Get integration type info by slug.
   */
  getIntegrationTypeInfo(type: string): IntegrationTypeInfo | null {
    const integration = this.registry.get(type);
    if (!integration) return null;
    return {
      type: integration.type,
      displayName: integration.displayName,
      description: integration.description,
      category: integration.category,
      requiredFields: integration.requiredFields,
      optionalFields: integration.optionalFields,
      supportedActions: integration.supportedActions,
    };
  }
}

// Export singleton instance
export const integrationManager = new IntegrationManager();
