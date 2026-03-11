"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const billing_service_1 = require("../../services/billing.service");
const subscription_model_1 = require("../../models/subscription.model");
const factories_1 = require("../factories");
describe("BillingService", () => {
    let userId;
    beforeEach(async () => {
        const user = await (0, factories_1.createTestUser)();
        userId = user._id.toString();
    });
    // ----- getSubscription -----
    describe("getSubscription", () => {
        it("should create a default developer subscription for new users", async () => {
            const subscription = await billing_service_1.BillingService.getSubscription(userId);
            expect(subscription).toBeDefined();
            expect(subscription.plan).toBe("developer");
            expect(subscription.billingCycle).toBe("monthly");
            expect(subscription.status).toBe("active");
            expect(subscription.usage.logsIngested).toBe(0);
            expect(subscription.usage.apiCalls).toBe(0);
        });
        it("should return existing subscription if one exists", async () => {
            await (0, factories_1.createTestSubscription)(userId, { plan: "starter" });
            const subscription = await billing_service_1.BillingService.getSubscription(userId);
            expect(subscription.plan).toBe("starter");
        });
        it("should throw for invalid userId", async () => {
            await expect(billing_service_1.BillingService.getSubscription("invalid-id")).rejects.toThrow(billing_service_1.BillingValidationError);
        });
        it("should auto-reset usage when period has ended", async () => {
            const pastEnd = new Date();
            pastEnd.setMonth(pastEnd.getMonth() - 1);
            await (0, factories_1.createTestSubscription)(userId, {
                usage: { logsIngested: 500, apiCalls: 100, lastResetAt: pastEnd },
                currentPeriodEnd: pastEnd,
            });
            const subscription = await billing_service_1.BillingService.getSubscription(userId);
            // Usage should have been reset
            expect(subscription.usage.logsIngested).toBe(0);
            expect(subscription.usage.apiCalls).toBe(0);
        });
    });
    // ----- checkLimit -----
    describe("checkLimit", () => {
        it("should allow when under the limit", async () => {
            await (0, factories_1.createTestSubscription)(userId, { plan: "developer" });
            const result = await billing_service_1.BillingService.checkLimit(userId, "projects");
            expect(result.allowed).toBe(true);
            expect(result.current).toBe(0);
            expect(result.limit).toBe(2); // developer plan limit
        });
        it("should deny when at the limit", async () => {
            await (0, factories_1.createTestSubscription)(userId, { plan: "developer" });
            // Create max projects for developer plan (2)
            await (0, factories_1.createTestProject)(userId, { name: "P1" });
            await (0, factories_1.createTestProject)(userId, { name: "P2" });
            const result = await billing_service_1.BillingService.checkLimit(userId, "projects");
            expect(result.allowed).toBe(false);
            expect(result.current).toBe(2);
        });
        it("should throw for unknown resource type", async () => {
            await (0, factories_1.createTestSubscription)(userId);
            await expect(billing_service_1.BillingService.checkLimit(userId, "nonExistentResource")).rejects.toThrow(billing_service_1.BillingValidationError);
        });
        it("should throw for invalid userId", async () => {
            await expect(billing_service_1.BillingService.checkLimit("bad-id", "projects")).rejects.toThrow(billing_service_1.BillingValidationError);
        });
    });
    // ----- incrementUsage -----
    describe("incrementUsage", () => {
        it("should increment logsIngested count", async () => {
            await (0, factories_1.createTestSubscription)(userId);
            await billing_service_1.BillingService.incrementUsage(userId, "logsIngested", 5);
            const sub = await subscription_model_1.SubscriptionModel.findOne({
                userId: new mongoose_1.Types.ObjectId(userId),
            });
            expect(sub.usage.logsIngested).toBe(5);
        });
        it("should increment apiCalls count", async () => {
            await (0, factories_1.createTestSubscription)(userId);
            await billing_service_1.BillingService.incrementUsage(userId, "apiCalls", 10);
            const sub = await subscription_model_1.SubscriptionModel.findOne({
                userId: new mongoose_1.Types.ObjectId(userId),
            });
            expect(sub.usage.apiCalls).toBe(10);
        });
        it("should default increment amount to 1", async () => {
            await (0, factories_1.createTestSubscription)(userId);
            await billing_service_1.BillingService.incrementUsage(userId, "logsIngested");
            const sub = await subscription_model_1.SubscriptionModel.findOne({
                userId: new mongoose_1.Types.ObjectId(userId),
            });
            expect(sub.usage.logsIngested).toBe(1);
        });
    });
    // ----- changePlan -----
    describe("changePlan", () => {
        it("should change plan from developer to starter", async () => {
            await (0, factories_1.createTestSubscription)(userId, { plan: "developer" });
            const result = await billing_service_1.BillingService.changePlan(userId, "starter", "monthly");
            expect(result.plan).toBe("starter");
            expect(result.billingCycle).toBe("monthly");
            expect(result.status).toBe("active");
        });
        it("should update billing cycle", async () => {
            await (0, factories_1.createTestSubscription)(userId, {
                plan: "starter",
                billingCycle: "monthly",
            });
            const result = await billing_service_1.BillingService.changePlan(userId, "starter", "annual");
            expect(result.billingCycle).toBe("annual");
        });
        it("should throw for invalid plan", async () => {
            await (0, factories_1.createTestSubscription)(userId);
            await expect(billing_service_1.BillingService.changePlan(userId, "nonexistent-plan", "monthly")).rejects.toThrow(billing_service_1.BillingValidationError);
        });
        it("should throw for enterprise plan (requires sales)", async () => {
            await (0, factories_1.createTestSubscription)(userId);
            await expect(billing_service_1.BillingService.changePlan(userId, "enterprise", "monthly")).rejects.toThrow("Enterprise plan requires contacting sales");
        });
        it("should throw when already on the same plan and cycle", async () => {
            await (0, factories_1.createTestSubscription)(userId, {
                plan: "starter",
                billingCycle: "monthly",
            });
            await expect(billing_service_1.BillingService.changePlan(userId, "starter", "monthly")).rejects.toThrow("You are already on this plan and billing cycle");
        });
    });
    // ----- cancelSubscription -----
    describe("cancelSubscription", () => {
        it("should cancel a paid subscription", async () => {
            await (0, factories_1.createTestSubscription)(userId, { plan: "starter" });
            const result = await billing_service_1.BillingService.cancelSubscription(userId);
            expect(result.status).toBe("canceled");
            expect(result.cancelAt).toBeDefined();
        });
        it("should throw when trying to cancel a free plan", async () => {
            await (0, factories_1.createTestSubscription)(userId, { plan: "developer" });
            await expect(billing_service_1.BillingService.cancelSubscription(userId)).rejects.toThrow("Cannot cancel a free plan");
        });
    });
    // ----- getPlans -----
    describe("getPlans", () => {
        it("should return all available plans", () => {
            const plans = billing_service_1.BillingService.getPlans();
            expect(Array.isArray(plans)).toBe(true);
            expect(plans.length).toBe(5); // developer, starter, professional, team, enterprise
            expect(plans.map((p) => p.id)).toContain("developer");
            expect(plans.map((p) => p.id)).toContain("enterprise");
        });
    });
    // ----- getUsage -----
    describe("getUsage", () => {
        it("should return usage data with percentages", async () => {
            await (0, factories_1.createTestSubscription)(userId, {
                plan: "developer",
                usage: { logsIngested: 5000, apiCalls: 50, lastResetAt: new Date() },
            });
            const usage = await billing_service_1.BillingService.getUsage(userId);
            expect(usage.plan).toBe("developer");
            expect(usage.planName).toBe("Developer");
            expect(usage.usage.logsIngested).toBe(5000);
            expect(usage.percentages.logsIngested).toBe(20); // 5000 / 25000 = 20%
        });
    });
    // ----- getInvoices -----
    describe("getInvoices", () => {
        it("should return empty array for free plan", async () => {
            await (0, factories_1.createTestSubscription)(userId, { plan: "developer" });
            const invoices = await billing_service_1.BillingService.getInvoices(userId);
            expect(invoices).toEqual([]);
        });
        it("should return mock invoices for paid plans", async () => {
            await (0, factories_1.createTestSubscription)(userId, { plan: "starter" });
            const invoices = await billing_service_1.BillingService.getInvoices(userId);
            expect(invoices.length).toBeGreaterThan(0);
            expect(invoices[0]).toHaveProperty("id");
            expect(invoices[0]).toHaveProperty("amount");
            expect(invoices[0]).toHaveProperty("status");
        });
    });
});
