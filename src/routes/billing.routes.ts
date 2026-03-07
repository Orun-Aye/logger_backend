// src/routes/billing.routes.ts

import { Router } from "express";
import { BillingController } from "../controllers/billing.controller";
import { verifyToken } from "../middleware/auth.middleware";

const router = Router();

// --- Public / Unauthenticated Routes ---
// Stripe webhook (no auth - Stripe validates via signature)
router.post("/webhooks", BillingController.handleWebhook);

// --- Authenticated Routes ---

// Get all available plans (public info but auth for consistency)
router.get("/plans", verifyToken, BillingController.getPlans);

// Get current subscription
router.get("/subscription", verifyToken, BillingController.getSubscription);

// Get current usage with percentages
router.get("/usage", verifyToken, BillingController.getUsage);

// Get invoice history
router.get("/invoices", verifyToken, BillingController.getInvoices);

// Create checkout session for plan upgrade
router.post("/checkout", verifyToken, BillingController.createCheckout);

// Create billing portal session
router.post("/portal", verifyToken, BillingController.createPortal);

// Change plan
router.post("/change-plan", verifyToken, BillingController.changePlan);

// Cancel subscription
router.post("/cancel", verifyToken, BillingController.cancelSubscription);

// Check limit for a specific resource
router.post("/check-limit", verifyToken, BillingController.checkLimit);

export default router;
