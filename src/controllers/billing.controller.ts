// src/controllers/billing.controller.ts

import { Request, Response } from "express";
import {
  BillingService,
  BillingValidationError,
  BillingOperationError,
} from "../services/billing.service";

interface ApiResponse<T = any> {
  status: "success" | "error";
  message?: string;
  data?: T;
  errors?: string[];
}

export class BillingController {
  /**
   * Centralized error handler for billing routes.
   */
  private static handleError(
    error: Error,
    res: Response,
    defaultMessage: string
  ): Response {
    console.error(`BillingController Error: ${error.message}`, error.stack);

    if (error instanceof BillingValidationError) {
      return res.status(400).json({
        status: "error",
        message: error.message,
      } as ApiResponse);
    }

    if (error instanceof BillingOperationError) {
      return res.status(500).json({
        status: "error",
        message: error.message,
      } as ApiResponse);
    }

    return res.status(500).json({
      status: "error",
      message: defaultMessage,
    } as ApiResponse);
  }

  /**
   * GET /billing/subscription
   * Get the current user's subscription.
   */
  static async getSubscription(req: Request, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Authentication required",
        } as ApiResponse);
      }

      const subscription = await BillingService.getSubscription(userId);

      return res.status(200).json({
        status: "success",
        data: subscription,
      } as ApiResponse);
    } catch (error) {
      return BillingController.handleError(
        error as Error,
        res,
        "Failed to get subscription"
      );
    }
  }

  /**
   * GET /billing/usage
   * Get current usage with percentages.
   */
  static async getUsage(req: Request, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Authentication required",
        } as ApiResponse);
      }

      const usage = await BillingService.getUsage(userId);

      return res.status(200).json({
        status: "success",
        data: usage,
      } as ApiResponse);
    } catch (error) {
      return BillingController.handleError(
        error as Error,
        res,
        "Failed to get usage data"
      );
    }
  }

  /**
   * GET /billing/plans
   * Get all available plan configurations.
   */
  static async getPlans(_req: Request, res: Response) {
    try {
      const plans = BillingService.getPlans();

      return res.status(200).json({
        status: "success",
        data: plans,
      } as ApiResponse);
    } catch (error) {
      return BillingController.handleError(
        error as Error,
        res,
        "Failed to get plans"
      );
    }
  }

  /**
   * POST /billing/checkout
   * Create a checkout session for plan upgrade.
   * Body: { planId: string, billingCycle: 'monthly' | 'annual' }
   */
  static async createCheckout(req: Request, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Authentication required",
        } as ApiResponse);
      }

      const { planId, billingCycle } = req.body;

      if (!planId) {
        return res.status(400).json({
          status: "error",
          message: "planId is required",
        } as ApiResponse);
      }

      if (!billingCycle || !["monthly", "annual"].includes(billingCycle)) {
        return res.status(400).json({
          status: "error",
          message: "billingCycle must be 'monthly' or 'annual'",
        } as ApiResponse);
      }

      const session = await BillingService.createCheckoutSession(
        userId,
        planId,
        billingCycle
      );

      return res.status(200).json({
        status: "success",
        data: session,
      } as ApiResponse);
    } catch (error) {
      return BillingController.handleError(
        error as Error,
        res,
        "Failed to create checkout session"
      );
    }
  }

  /**
   * POST /billing/portal
   * Create a billing portal session.
   */
  static async createPortal(req: Request, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Authentication required",
        } as ApiResponse);
      }

      const session = await BillingService.createPortalSession(userId);

      return res.status(200).json({
        status: "success",
        data: session,
      } as ApiResponse);
    } catch (error) {
      return BillingController.handleError(
        error as Error,
        res,
        "Failed to create portal session"
      );
    }
  }

  /**
   * GET /billing/invoices
   * Get invoice history.
   */
  static async getInvoices(req: Request, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Authentication required",
        } as ApiResponse);
      }

      const invoices = await BillingService.getInvoices(userId);

      return res.status(200).json({
        status: "success",
        data: invoices,
      } as ApiResponse);
    } catch (error) {
      return BillingController.handleError(
        error as Error,
        res,
        "Failed to get invoices"
      );
    }
  }

  /**
   * POST /billing/change-plan
   * Change the current plan.
   * Body: { plan: string, billingCycle: 'monthly' | 'annual' }
   */
  static async changePlan(req: Request, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Authentication required",
        } as ApiResponse);
      }

      const { plan, billingCycle } = req.body;

      if (!plan) {
        return res.status(400).json({
          status: "error",
          message: "plan is required",
        } as ApiResponse);
      }

      if (!billingCycle || !["monthly", "annual"].includes(billingCycle)) {
        return res.status(400).json({
          status: "error",
          message: "billingCycle must be 'monthly' or 'annual'",
        } as ApiResponse);
      }

      const subscription = await BillingService.changePlan(
        userId,
        plan,
        billingCycle
      );

      return res.status(200).json({
        status: "success",
        message: "Plan changed successfully",
        data: subscription,
      } as ApiResponse);
    } catch (error) {
      return BillingController.handleError(
        error as Error,
        res,
        "Failed to change plan"
      );
    }
  }

  /**
   * POST /billing/cancel
   * Cancel the current subscription (at period end).
   */
  static async cancelSubscription(req: Request, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Authentication required",
        } as ApiResponse);
      }

      const subscription = await BillingService.cancelSubscription(userId);

      return res.status(200).json({
        status: "success",
        message: "Subscription will be canceled at the end of the current period",
        data: subscription,
      } as ApiResponse);
    } catch (error) {
      return BillingController.handleError(
        error as Error,
        res,
        "Failed to cancel subscription"
      );
    }
  }

  /**
   * POST /billing/check-limit
   * Check if a specific resource is within plan limits.
   * Body: { resource: string }
   */
  static async checkLimit(req: Request, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Authentication required",
        } as ApiResponse);
      }

      const { resource } = req.body;

      if (!resource) {
        return res.status(400).json({
          status: "error",
          message: "resource is required",
        } as ApiResponse);
      }

      const result = await BillingService.checkLimit(userId, resource);

      return res.status(200).json({
        status: "success",
        data: result,
      } as ApiResponse);
    } catch (error) {
      return BillingController.handleError(
        error as Error,
        res,
        "Failed to check limit"
      );
    }
  }

  /**
   * POST /billing/webhooks
   * Handle Stripe webhooks (stub).
   */
  static async handleWebhook(req: Request, res: Response) {
    try {
      const signature = req.headers["stripe-signature"] as string || "";
      const result = await BillingService.handleWebhook(req.body, signature);

      return res.status(200).json({
        status: "success",
        data: result,
      } as ApiResponse);
    } catch (error) {
      console.error("Webhook error:", error);
      return res.status(400).json({
        status: "error",
        message: "Webhook processing failed",
      } as ApiResponse);
    }
  }
}
