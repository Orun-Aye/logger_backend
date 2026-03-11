"use strict";
// src/routes/billing.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const billing_controller_1 = require("../controllers/billing.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// --- Public / Unauthenticated Routes ---
// Stripe webhook (no auth - Stripe validates via signature)
router.post("/webhooks", billing_controller_1.BillingController.handleWebhook);
// --- Authenticated Routes ---
// Get all available plans (public info but auth for consistency)
router.get("/plans", auth_middleware_1.verifyToken, billing_controller_1.BillingController.getPlans);
// Get current subscription
router.get("/subscription", auth_middleware_1.verifyToken, billing_controller_1.BillingController.getSubscription);
// Get current usage with percentages
router.get("/usage", auth_middleware_1.verifyToken, billing_controller_1.BillingController.getUsage);
// Get invoice history
router.get("/invoices", auth_middleware_1.verifyToken, billing_controller_1.BillingController.getInvoices);
// Create checkout session for plan upgrade
router.post("/checkout", auth_middleware_1.verifyToken, billing_controller_1.BillingController.createCheckout);
// Create billing portal session
router.post("/portal", auth_middleware_1.verifyToken, billing_controller_1.BillingController.createPortal);
// Change plan
router.post("/change-plan", auth_middleware_1.verifyToken, billing_controller_1.BillingController.changePlan);
// Cancel subscription
router.post("/cancel", auth_middleware_1.verifyToken, billing_controller_1.BillingController.cancelSubscription);
// Check limit for a specific resource
router.post("/check-limit", auth_middleware_1.verifyToken, billing_controller_1.BillingController.checkLimit);
exports.default = router;
