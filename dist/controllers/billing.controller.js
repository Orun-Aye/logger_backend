"use strict";
// src/controllers/billing.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingController = void 0;
const billing_service_1 = require("../services/billing.service");
class BillingController {
    /**
     * Centralized error handler for billing routes.
     */
    static handleError(error, res, defaultMessage) {
        console.error(`BillingController Error: ${error.message}`, error.stack);
        if (error instanceof billing_service_1.BillingValidationError) {
            return res.status(400).json({
                status: "error",
                message: error.message,
            });
        }
        if (error instanceof billing_service_1.BillingOperationError) {
            return res.status(500).json({
                status: "error",
                message: error.message,
            });
        }
        return res.status(500).json({
            status: "error",
            message: defaultMessage,
        });
    }
    /**
     * GET /billing/subscription
     * Get the current user's subscription.
     */
    static async getSubscription(req, res) {
        try {
            const userId = req.userId;
            if (!userId) {
                return res.status(401).json({
                    status: "error",
                    message: "Authentication required",
                });
            }
            const subscription = await billing_service_1.BillingService.getSubscription(userId);
            return res.status(200).json({
                status: "success",
                data: subscription,
            });
        }
        catch (error) {
            return BillingController.handleError(error, res, "Failed to get subscription");
        }
    }
    /**
     * GET /billing/usage
     * Get current usage with percentages.
     */
    static async getUsage(req, res) {
        try {
            const userId = req.userId;
            if (!userId) {
                return res.status(401).json({
                    status: "error",
                    message: "Authentication required",
                });
            }
            const usage = await billing_service_1.BillingService.getUsage(userId);
            return res.status(200).json({
                status: "success",
                data: usage,
            });
        }
        catch (error) {
            return BillingController.handleError(error, res, "Failed to get usage data");
        }
    }
    /**
     * GET /billing/plans
     * Get all available plan configurations.
     */
    static async getPlans(_req, res) {
        try {
            const plans = billing_service_1.BillingService.getPlans();
            return res.status(200).json({
                status: "success",
                data: plans,
            });
        }
        catch (error) {
            return BillingController.handleError(error, res, "Failed to get plans");
        }
    }
    /**
     * POST /billing/checkout
     * Create a checkout session for plan upgrade.
     * Body: { planId: string, billingCycle: 'monthly' | 'annual' }
     */
    static async createCheckout(req, res) {
        try {
            const userId = req.userId;
            if (!userId) {
                return res.status(401).json({
                    status: "error",
                    message: "Authentication required",
                });
            }
            const { planId, billingCycle } = req.body;
            if (!planId) {
                return res.status(400).json({
                    status: "error",
                    message: "planId is required",
                });
            }
            if (!billingCycle || !["monthly", "annual"].includes(billingCycle)) {
                return res.status(400).json({
                    status: "error",
                    message: "billingCycle must be 'monthly' or 'annual'",
                });
            }
            const session = await billing_service_1.BillingService.createCheckoutSession(userId, planId, billingCycle);
            return res.status(200).json({
                status: "success",
                data: session,
            });
        }
        catch (error) {
            return BillingController.handleError(error, res, "Failed to create checkout session");
        }
    }
    /**
     * POST /billing/portal
     * Create a billing portal session.
     */
    static async createPortal(req, res) {
        try {
            const userId = req.userId;
            if (!userId) {
                return res.status(401).json({
                    status: "error",
                    message: "Authentication required",
                });
            }
            const session = await billing_service_1.BillingService.createPortalSession(userId);
            return res.status(200).json({
                status: "success",
                data: session,
            });
        }
        catch (error) {
            return BillingController.handleError(error, res, "Failed to create portal session");
        }
    }
    /**
     * GET /billing/invoices
     * Get invoice history.
     */
    static async getInvoices(req, res) {
        try {
            const userId = req.userId;
            if (!userId) {
                return res.status(401).json({
                    status: "error",
                    message: "Authentication required",
                });
            }
            const invoices = await billing_service_1.BillingService.getInvoices(userId);
            return res.status(200).json({
                status: "success",
                data: invoices,
            });
        }
        catch (error) {
            return BillingController.handleError(error, res, "Failed to get invoices");
        }
    }
    /**
     * POST /billing/change-plan
     * Change the current plan.
     * Body: { plan: string, billingCycle: 'monthly' | 'annual' }
     */
    static async changePlan(req, res) {
        try {
            const userId = req.userId;
            if (!userId) {
                return res.status(401).json({
                    status: "error",
                    message: "Authentication required",
                });
            }
            const { plan, billingCycle } = req.body;
            if (!plan) {
                return res.status(400).json({
                    status: "error",
                    message: "plan is required",
                });
            }
            if (!billingCycle || !["monthly", "annual"].includes(billingCycle)) {
                return res.status(400).json({
                    status: "error",
                    message: "billingCycle must be 'monthly' or 'annual'",
                });
            }
            const subscription = await billing_service_1.BillingService.changePlan(userId, plan, billingCycle);
            return res.status(200).json({
                status: "success",
                message: "Plan changed successfully",
                data: subscription,
            });
        }
        catch (error) {
            return BillingController.handleError(error, res, "Failed to change plan");
        }
    }
    /**
     * POST /billing/cancel
     * Cancel the current subscription (at period end).
     */
    static async cancelSubscription(req, res) {
        try {
            const userId = req.userId;
            if (!userId) {
                return res.status(401).json({
                    status: "error",
                    message: "Authentication required",
                });
            }
            const subscription = await billing_service_1.BillingService.cancelSubscription(userId);
            return res.status(200).json({
                status: "success",
                message: "Subscription will be canceled at the end of the current period",
                data: subscription,
            });
        }
        catch (error) {
            return BillingController.handleError(error, res, "Failed to cancel subscription");
        }
    }
    /**
     * POST /billing/check-limit
     * Check if a specific resource is within plan limits.
     * Body: { resource: string }
     */
    static async checkLimit(req, res) {
        try {
            const userId = req.userId;
            if (!userId) {
                return res.status(401).json({
                    status: "error",
                    message: "Authentication required",
                });
            }
            const { resource } = req.body;
            if (!resource) {
                return res.status(400).json({
                    status: "error",
                    message: "resource is required",
                });
            }
            const result = await billing_service_1.BillingService.checkLimit(userId, resource);
            return res.status(200).json({
                status: "success",
                data: result,
            });
        }
        catch (error) {
            return BillingController.handleError(error, res, "Failed to check limit");
        }
    }
    /**
     * POST /billing/webhooks
     * Handle Stripe webhooks (stub).
     */
    static async handleWebhook(req, res) {
        try {
            const signature = req.headers["stripe-signature"] || "";
            const result = await billing_service_1.BillingService.handleWebhook(req.body, signature);
            return res.status(200).json({
                status: "success",
                data: result,
            });
        }
        catch (error) {
            console.error("Webhook error:", error);
            return res.status(400).json({
                status: "error",
                message: "Webhook processing failed",
            });
        }
    }
}
exports.BillingController = BillingController;
