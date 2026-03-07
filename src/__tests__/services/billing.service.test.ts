import { Types } from "mongoose";
import {
  BillingService,
  BillingValidationError,
} from "../../services/billing.service";
import { SubscriptionModel } from "../../models/subscription.model";
import {
  createTestUser,
  createTestProject,
  createTestSubscription,
} from "../factories";

describe("BillingService", () => {
  let userId: string;

  beforeEach(async () => {
    const user = await createTestUser();
    userId = user._id.toString();
  });

  // ----- getSubscription -----
  describe("getSubscription", () => {
    it("should create a default developer subscription for new users", async () => {
      const subscription = await BillingService.getSubscription(userId);

      expect(subscription).toBeDefined();
      expect(subscription.plan).toBe("developer");
      expect(subscription.billingCycle).toBe("monthly");
      expect(subscription.status).toBe("active");
      expect(subscription.usage.logsIngested).toBe(0);
      expect(subscription.usage.apiCalls).toBe(0);
    });

    it("should return existing subscription if one exists", async () => {
      await createTestSubscription(userId, { plan: "starter" });

      const subscription = await BillingService.getSubscription(userId);

      expect(subscription.plan).toBe("starter");
    });

    it("should throw for invalid userId", async () => {
      await expect(
        BillingService.getSubscription("invalid-id")
      ).rejects.toThrow(BillingValidationError);
    });

    it("should auto-reset usage when period has ended", async () => {
      const pastEnd = new Date();
      pastEnd.setMonth(pastEnd.getMonth() - 1);

      await createTestSubscription(userId, {
        usage: { logsIngested: 500, apiCalls: 100, lastResetAt: pastEnd },
        currentPeriodEnd: pastEnd,
      });

      const subscription = await BillingService.getSubscription(userId);

      // Usage should have been reset
      expect(subscription.usage.logsIngested).toBe(0);
      expect(subscription.usage.apiCalls).toBe(0);
    });
  });

  // ----- checkLimit -----
  describe("checkLimit", () => {
    it("should allow when under the limit", async () => {
      await createTestSubscription(userId, { plan: "developer" });

      const result = await BillingService.checkLimit(userId, "projects");

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(0);
      expect(result.limit).toBe(2); // developer plan limit
    });

    it("should deny when at the limit", async () => {
      await createTestSubscription(userId, { plan: "developer" });
      // Create max projects for developer plan (2)
      await createTestProject(userId, { name: "P1" });
      await createTestProject(userId, { name: "P2" });

      const result = await BillingService.checkLimit(userId, "projects");

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(2);
    });

    it("should throw for unknown resource type", async () => {
      await createTestSubscription(userId);

      await expect(
        BillingService.checkLimit(userId, "nonExistentResource")
      ).rejects.toThrow(BillingValidationError);
    });

    it("should throw for invalid userId", async () => {
      await expect(
        BillingService.checkLimit("bad-id", "projects")
      ).rejects.toThrow(BillingValidationError);
    });
  });

  // ----- incrementUsage -----
  describe("incrementUsage", () => {
    it("should increment logsIngested count", async () => {
      await createTestSubscription(userId);

      await BillingService.incrementUsage(userId, "logsIngested", 5);

      const sub = await SubscriptionModel.findOne({
        userId: new Types.ObjectId(userId),
      });
      expect(sub!.usage.logsIngested).toBe(5);
    });

    it("should increment apiCalls count", async () => {
      await createTestSubscription(userId);

      await BillingService.incrementUsage(userId, "apiCalls", 10);

      const sub = await SubscriptionModel.findOne({
        userId: new Types.ObjectId(userId),
      });
      expect(sub!.usage.apiCalls).toBe(10);
    });

    it("should default increment amount to 1", async () => {
      await createTestSubscription(userId);

      await BillingService.incrementUsage(userId, "logsIngested");

      const sub = await SubscriptionModel.findOne({
        userId: new Types.ObjectId(userId),
      });
      expect(sub!.usage.logsIngested).toBe(1);
    });
  });

  // ----- changePlan -----
  describe("changePlan", () => {
    it("should change plan from developer to starter", async () => {
      await createTestSubscription(userId, { plan: "developer" });

      const result = await BillingService.changePlan(
        userId,
        "starter",
        "monthly"
      );

      expect(result.plan).toBe("starter");
      expect(result.billingCycle).toBe("monthly");
      expect(result.status).toBe("active");
    });

    it("should update billing cycle", async () => {
      await createTestSubscription(userId, {
        plan: "starter",
        billingCycle: "monthly",
      });

      const result = await BillingService.changePlan(
        userId,
        "starter",
        "annual"
      );

      expect(result.billingCycle).toBe("annual");
    });

    it("should throw for invalid plan", async () => {
      await createTestSubscription(userId);

      await expect(
        BillingService.changePlan(userId, "nonexistent-plan", "monthly")
      ).rejects.toThrow(BillingValidationError);
    });

    it("should throw for enterprise plan (requires sales)", async () => {
      await createTestSubscription(userId);

      await expect(
        BillingService.changePlan(userId, "enterprise", "monthly")
      ).rejects.toThrow("Enterprise plan requires contacting sales");
    });

    it("should throw when already on the same plan and cycle", async () => {
      await createTestSubscription(userId, {
        plan: "starter",
        billingCycle: "monthly",
      });

      await expect(
        BillingService.changePlan(userId, "starter", "monthly")
      ).rejects.toThrow("You are already on this plan and billing cycle");
    });
  });

  // ----- cancelSubscription -----
  describe("cancelSubscription", () => {
    it("should cancel a paid subscription", async () => {
      await createTestSubscription(userId, { plan: "starter" });

      const result = await BillingService.cancelSubscription(userId);

      expect(result.status).toBe("canceled");
      expect(result.cancelAt).toBeDefined();
    });

    it("should throw when trying to cancel a free plan", async () => {
      await createTestSubscription(userId, { plan: "developer" });

      await expect(
        BillingService.cancelSubscription(userId)
      ).rejects.toThrow("Cannot cancel a free plan");
    });
  });

  // ----- getPlans -----
  describe("getPlans", () => {
    it("should return all available plans", () => {
      const plans = BillingService.getPlans();

      expect(Array.isArray(plans)).toBe(true);
      expect(plans.length).toBe(5); // developer, starter, professional, team, enterprise
      expect(plans.map((p) => p.id)).toContain("developer");
      expect(plans.map((p) => p.id)).toContain("enterprise");
    });
  });

  // ----- getUsage -----
  describe("getUsage", () => {
    it("should return usage data with percentages", async () => {
      await createTestSubscription(userId, {
        plan: "developer",
        usage: { logsIngested: 5000, apiCalls: 50, lastResetAt: new Date() },
      });

      const usage = await BillingService.getUsage(userId);

      expect(usage.plan).toBe("developer");
      expect(usage.planName).toBe("Developer");
      expect(usage.usage.logsIngested).toBe(5000);
      expect(usage.percentages.logsIngested).toBe(20); // 5000 / 25000 = 20%
    });
  });

  // ----- getInvoices -----
  describe("getInvoices", () => {
    it("should return empty array for free plan", async () => {
      await createTestSubscription(userId, { plan: "developer" });

      const invoices = await BillingService.getInvoices(userId);

      expect(invoices).toEqual([]);
    });

    it("should return mock invoices for paid plans", async () => {
      await createTestSubscription(userId, { plan: "starter" });

      const invoices = await BillingService.getInvoices(userId);

      expect(invoices.length).toBeGreaterThan(0);
      expect(invoices[0]).toHaveProperty("id");
      expect(invoices[0]).toHaveProperty("amount");
      expect(invoices[0]).toHaveProperty("status");
    });
  });
});
