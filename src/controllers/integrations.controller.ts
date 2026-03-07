import { Request, Response } from "express";
import mongoose from "mongoose";
import { integrationManager } from "../services/integrations/integration.manager";

export class IntegrationsController {
  /**
   * GET /integrations/available
   * List all available integration types with setup info.
   */
  static async getAvailableIntegrations(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const integrations = integrationManager.getAvailableIntegrations();
      return res.status(200).json({
        status: "success",
        data: integrations,
      });
    } catch (error) {
      return res.status(500).json({
        status: "error",
        message: "Failed to fetch available integrations",
        details: (error as Error).message,
      });
    }
  }

  /**
   * GET /integrations/connected
   * List connected integrations for the authenticated user.
   * Query params: ?projectId=xxx
   */
  static async getConnectedIntegrations(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      const { projectId } = req.query;
      if (projectId && !mongoose.Types.ObjectId.isValid(projectId as string)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid project ID",
        });
      }

      const integrations = await integrationManager.getConnectedIntegrations(
        userId,
        projectId as string | undefined
      );

      return res.status(200).json({
        status: "success",
        data: integrations,
      });
    } catch (error) {
      return res.status(500).json({
        status: "error",
        message: "Failed to fetch connected integrations",
        details: (error as Error).message,
      });
    }
  }

  /**
   * GET /integrations/:id
   * Get a single integration by ID.
   */
  static async getIntegrationById(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid integration ID",
        });
      }

      const integration = await integrationManager.getIntegrationById(
        id,
        userId
      );

      if (!integration) {
        return res.status(404).json({
          status: "error",
          message: "Integration not found",
        });
      }

      return res.status(200).json({
        status: "success",
        data: integration,
      });
    } catch (error) {
      return res.status(500).json({
        status: "error",
        message: "Failed to fetch integration",
        details: (error as Error).message,
      });
    }
  }

  /**
   * GET /integrations/type/:type
   * Get integration type metadata by slug.
   */
  static async getIntegrationType(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const { type } = req.params;
      const info = integrationManager.getIntegrationTypeInfo(type);

      if (!info) {
        return res.status(404).json({
          status: "error",
          message: `Integration type "${type}" not found`,
        });
      }

      return res.status(200).json({
        status: "success",
        data: info,
      });
    } catch (error) {
      return res.status(500).json({
        status: "error",
        message: "Failed to fetch integration type info",
        details: (error as Error).message,
      });
    }
  }

  /**
   * POST /integrations/:type/connect
   * Connect a new integration.
   * Body: { config: {...}, projectId?: string, organizationId?: string }
   */
  static async connectIntegration(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      const { type } = req.params;
      const { config, projectId, organizationId } = req.body;

      if (!config || typeof config !== "object") {
        return res.status(400).json({
          status: "error",
          message: "config object is required",
        });
      }

      if (projectId && !mongoose.Types.ObjectId.isValid(projectId)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid project ID",
        });
      }

      const integration = await integrationManager.connectIntegration(
        userId,
        type,
        config,
        projectId,
        organizationId
      );

      return res.status(201).json({
        status: "success",
        message: `${type} integration connected successfully`,
        data: {
          _id: integration._id,
          type: integration.type,
          status: integration.status,
          projectId: integration.projectId,
          metadata: integration.metadata,
          createdAt: integration.createdAt,
          updatedAt: integration.updatedAt,
        },
      });
    } catch (error) {
      const message = (error as Error).message;
      const statusCode = message.includes("not found") ||
        message.includes("Unknown integration")
        ? 400
        : message.includes("Connection failed")
          ? 422
          : 500;

      return res.status(statusCode).json({
        status: "error",
        message: `Failed to connect integration: ${message}`,
      });
    }
  }

  /**
   * POST /integrations/:id/test
   * Test an existing integration.
   */
  static async testIntegrationById(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid integration ID",
        });
      }

      const result = await integrationManager.testIntegration(id, userId);

      return res.status(result.success ? 200 : 422).json({
        status: result.success ? "success" : "error",
        message: result.message,
        data: { success: result.success },
      });
    } catch (error) {
      const message = (error as Error).message;
      const statusCode = message.includes("not found") ? 404 : 500;

      return res.status(statusCode).json({
        status: "error",
        message: `Failed to test integration: ${message}`,
      });
    }
  }

  /**
   * DELETE /integrations/:id
   * Disconnect (remove) an integration.
   */
  static async disconnectIntegration(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid integration ID",
        });
      }

      await integrationManager.disconnectIntegration(id, userId);

      return res.status(200).json({
        status: "success",
        message: "Integration disconnected successfully",
      });
    } catch (error) {
      const message = (error as Error).message;
      const statusCode = message.includes("not found") ? 404 : 500;

      return res.status(statusCode).json({
        status: "error",
        message: `Failed to disconnect integration: ${message}`,
      });
    }
  }

  /**
   * POST /integrations/:id/action
   * Execute an action on a connected integration.
   * Body: { action: string, payload: {...} }
   */
  static async executeAction(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid integration ID",
        });
      }

      const { action, payload } = req.body;

      if (!action || typeof action !== "string") {
        return res.status(400).json({
          status: "error",
          message: "action string is required",
        });
      }

      const result = await integrationManager.executeAction(
        id,
        userId,
        action,
        payload || {}
      );

      return res.status(result.success ? 200 : 422).json({
        status: result.success ? "success" : "error",
        message: result.message,
        data: result.data,
      });
    } catch (error) {
      const message = (error as Error).message;
      const statusCode = message.includes("not found")
        ? 404
        : message.includes("not connected")
          ? 409
          : 500;

      return res.status(statusCode).json({
        status: "error",
        message: `Failed to execute action: ${message}`,
      });
    }
  }
}
