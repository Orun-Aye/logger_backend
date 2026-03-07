// src/services/billing.service.ts

import { Types } from "mongoose";
import {
  SubscriptionModel,
  ISubscription,
} from "../models/subscription.model";
import { ProjectModel } from "../models/project.model";
import { AlertRuleModel } from "../models/alertRule.model";
import { CustomDashboardModel } from "../models/customDashboard.model";
import { ApiTokenModel } from "../models/apiToken.model";
import {
  PLANS,
  PlanConfig,
  PlanId,
  PlanLimits,
  getPlanConfig,
  getAllPlans,
  getUsagePercentage,
} from "../config/plans.config";

// Custom error classes
export class BillingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BillingValidationError";
  }
}

export class BillingOperationError extends Error {
  constructor(message: string, public context?: any) {
    super(message);
    this.name = "BillingOperationError";
  }
}

export interface UsageData {
  plan: string;
  planName: string;
  limits: PlanLimits;
  usage: {
    logsIngested: number;
    apiCalls: number;
    projects: number;
    teamMembers: number;
    alertRules: number;
    customDashboards: number;
    apiTokens: number;
  };
  percentages: {
    logsIngested: number;
    apiCalls: number;
    projects: number;
    teamMembers: number;
    alertRules: number;
    customDashboards: number;
    apiTokens: number;
  };
}

export interface InvoiceRecord {
  id: string;
  date: string;
  amount: number; // in cents
  status: "paid" | "pending" | "failed";
  plan: string;
  billingCycle: "monthly" | "annual";
  description: string;
}

export interface LimitCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  percentage: number;
}

export class BillingService {
  /**
   * Get or create a subscription for a user.
   * New users default to the Developer (free) plan.
   */
  static async getSubscription(userId: string): Promise<ISubscription> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BillingValidationError("Invalid user ID");
    }

    let subscription = await SubscriptionModel.findOne({
      userId: new Types.ObjectId(userId),
    });

    if (!subscription) {
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      subscription = await SubscriptionModel.create({
        userId: new Types.ObjectId(userId),
        plan: "developer",
        billingCycle: "monthly",
        status: "active",
        usage: {
          logsIngested: 0,
          apiCalls: 0,
          lastResetAt: now,
        },
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      });
    }

    // Auto-reset usage if we've passed the period end
    if (subscription.currentPeriodEnd < new Date()) {
      await this.resetUsagePeriod(subscription);
    }

    return subscription;
  }

  /**
   * Reset usage counters and advance the billing period.
   */
  private static async resetUsagePeriod(
    subscription: ISubscription
  ): Promise<void> {
    const now = new Date();
    const newEnd = new Date(now);
    if (subscription.billingCycle === "annual") {
      newEnd.setFullYear(newEnd.getFullYear() + 1);
    } else {
      newEnd.setMonth(newEnd.getMonth() + 1);
    }

    subscription.usage.logsIngested = 0;
    subscription.usage.apiCalls = 0;
    subscription.usage.lastResetAt = now;
    subscription.currentPeriodStart = now;
    subscription.currentPeriodEnd = newEnd;
    await subscription.save();
  }

  /**
   * Create a mock checkout session URL.
   * In production, this would create a Stripe Checkout session.
   */
  static async createCheckoutSession(
    userId: string,
    planId: string,
    billingCycle: "monthly" | "annual"
  ): Promise<{ url: string; sessionId: string }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BillingValidationError("Invalid user ID");
    }

    const plan = PLANS[planId as PlanId];
    if (!plan) {
      throw new BillingValidationError(`Invalid plan ID: ${planId}`);
    }

    if (plan.monthlyPrice === -1) {
      throw new BillingValidationError(
        "Enterprise plan requires contacting sales"
      );
    }

    if (plan.monthlyPrice === 0) {
      throw new BillingValidationError(
        "Developer plan is free, no checkout needed"
      );
    }

    // Mock: generate a fake session ID and URL
    const sessionId = `cs_mock_${Date.now()}_${Math.random()
      .toString(36)
      .substring(7)}`;

    return {
      url: `https://checkout.stripe.com/mock/${sessionId}?plan=${planId}&cycle=${billingCycle}`,
      sessionId,
    };
  }

  /**
   * Create a mock billing portal session URL.
   * In production, this would create a Stripe Customer Portal session.
   */
  static async createPortalSession(
    userId: string
  ): Promise<{ url: string }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BillingValidationError("Invalid user ID");
    }

    // Ensure subscription exists
    await this.getSubscription(userId);

    return {
      url: `https://billing.stripe.com/mock/portal?user=${userId}`,
    };
  }

  /**
   * Get current usage data with plan limits and percentages.
   */
  static async getUsage(userId: string): Promise<UsageData> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BillingValidationError("Invalid user ID");
    }

    const subscription = await this.getSubscription(userId);
    const planConfig = getPlanConfig(subscription.plan);
    const limits = planConfig.limits;
    const userObjId = new Types.ObjectId(userId);

    // Count actual resource usage in parallel
    const [projectCount, teamMemberCount, alertRuleCount, customDashboardCount, apiTokenCount] =
      await Promise.all([
        // Projects owned by user
        ProjectModel.countDocuments({ ownerId: userObjId, isActive: true }),
        // Unique team members across all projects owned by user
        this.countTeamMembers(userId),
        // Alert rules across user's projects
        this.countAlertRules(userId),
        // Custom dashboards
        CustomDashboardModel.countDocuments({ userId: userObjId }),
        // API tokens
        ApiTokenModel.countDocuments({ userId: userObjId, isActive: true }),
      ]);

    const usage = {
      logsIngested: subscription.usage.logsIngested,
      apiCalls: subscription.usage.apiCalls,
      projects: projectCount,
      teamMembers: teamMemberCount,
      alertRules: alertRuleCount,
      customDashboards: customDashboardCount,
      apiTokens: apiTokenCount,
    };

    const percentages = {
      logsIngested: getUsagePercentage(usage.logsIngested, limits.maxLogs),
      apiCalls: 0, // API calls not separately limited for now
      projects: getUsagePercentage(usage.projects, limits.maxProjects),
      teamMembers: getUsagePercentage(usage.teamMembers, limits.maxTeamMembers),
      alertRules: getUsagePercentage(usage.alertRules, limits.maxAlertRules),
      customDashboards: getUsagePercentage(
        usage.customDashboards,
        limits.maxCustomDashboards
      ),
      apiTokens: getUsagePercentage(usage.apiTokens, limits.maxApiTokens),
    };

    return {
      plan: subscription.plan,
      planName: planConfig.name,
      limits,
      usage,
      percentages,
    };
  }

  /**
   * Count unique team members across all projects owned by a user.
   */
  private static async countTeamMembers(userId: string): Promise<number> {
    const projects = await ProjectModel.find(
      { ownerId: new Types.ObjectId(userId), isActive: true },
      { teamMembers: 1 }
    ).lean();

    const uniqueMembers = new Set<string>();
    for (const project of projects) {
      if (project.teamMembers) {
        for (const member of project.teamMembers) {
          uniqueMembers.add(member.user.toString());
        }
      }
    }
    return uniqueMembers.size;
  }

  /**
   * Count alert rules across all projects owned by a user.
   */
  private static async countAlertRules(userId: string): Promise<number> {
    const projects = await ProjectModel.find(
      { ownerId: new Types.ObjectId(userId), isActive: true },
      { _id: 1 }
    ).lean();

    const projectIds = projects.map((p) => p._id.toString());

    if (projectIds.length === 0) return 0;

    return AlertRuleModel.countDocuments({
      projectId: { $in: projectIds },
    });
  }

  /**
   * Get mock invoice history.
   * In production, this would query Stripe for invoice data.
   */
  static async getInvoices(userId: string): Promise<InvoiceRecord[]> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BillingValidationError("Invalid user ID");
    }

    const subscription = await this.getSubscription(userId);

    // For free plan, no invoices
    if (subscription.plan === "developer") {
      return [];
    }

    const planConfig = getPlanConfig(subscription.plan);
    const price =
      subscription.billingCycle === "annual"
        ? planConfig.annualPrice
        : planConfig.monthlyPrice;

    // Generate mock invoice history (last 6 months or since subscription)
    const invoices: InvoiceRecord[] = [];
    const now = new Date();
    const startDate = new Date(subscription.createdAt);
    const monthsDiff = Math.min(
      6,
      (now.getFullYear() - startDate.getFullYear()) * 12 +
        now.getMonth() -
        startDate.getMonth() +
        1
    );

    for (let i = 0; i < Math.max(1, monthsDiff); i++) {
      const invoiceDate = new Date(now);
      invoiceDate.setMonth(invoiceDate.getMonth() - i);

      invoices.push({
        id: `inv_mock_${subscription._id}_${i}`,
        date: invoiceDate.toISOString(),
        amount: subscription.billingCycle === "annual" && i === 0
          ? planConfig.annualPrice * 12
          : price,
        status: i === 0 ? "paid" : "paid",
        plan: planConfig.name,
        billingCycle: subscription.billingCycle,
        description: `${planConfig.name} plan - ${
          subscription.billingCycle === "annual" ? "Annual" : "Monthly"
        } subscription`,
      });
    }

    return invoices;
  }

  /**
   * Check if a specific resource action is within plan limits.
   */
  static async checkLimit(
    userId: string,
    resource: string
  ): Promise<LimitCheckResult> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BillingValidationError("Invalid user ID");
    }

    const usageData = await this.getUsage(userId);
    const limits = usageData.limits;
    const usage = usageData.usage;

    let current: number;
    let limit: number;

    switch (resource) {
      case "logsIngested":
        current = usage.logsIngested;
        limit = limits.maxLogs;
        break;
      case "projects":
        current = usage.projects;
        limit = limits.maxProjects;
        break;
      case "teamMembers":
        current = usage.teamMembers;
        limit = limits.maxTeamMembers;
        break;
      case "alertRules":
        current = usage.alertRules;
        limit = limits.maxAlertRules;
        break;
      case "customDashboards":
        current = usage.customDashboards;
        limit = limits.maxCustomDashboards;
        break;
      case "apiTokens":
        current = usage.apiTokens;
        limit = limits.maxApiTokens;
        break;
      default:
        throw new BillingValidationError(`Unknown resource: ${resource}`);
    }

    const percentage = getUsagePercentage(current, limit);
    const allowed = limit === -1 || current < limit;

    return { allowed, current, limit, percentage };
  }

  /**
   * Increment a usage counter (logs ingested or API calls).
   */
  static async incrementUsage(
    userId: string,
    resource: "logsIngested" | "apiCalls",
    amount: number = 1
  ): Promise<void> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BillingValidationError("Invalid user ID");
    }

    const updateField = `usage.${resource}`;
    await SubscriptionModel.updateOne(
      { userId: new Types.ObjectId(userId) },
      { $inc: { [updateField]: amount } }
    );
  }

  /**
   * Change the plan for a user.
   * In production, this would update the Stripe subscription.
   */
  static async changePlan(
    userId: string,
    newPlan: string,
    billingCycle: "monthly" | "annual"
  ): Promise<ISubscription> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BillingValidationError("Invalid user ID");
    }

    const planConfig = PLANS[newPlan as PlanId];
    if (!planConfig) {
      throw new BillingValidationError(`Invalid plan: ${newPlan}`);
    }

    if (planConfig.monthlyPrice === -1) {
      throw new BillingValidationError(
        "Enterprise plan requires contacting sales"
      );
    }

    const subscription = await this.getSubscription(userId);

    if (subscription.plan === newPlan && subscription.billingCycle === billingCycle) {
      throw new BillingValidationError(
        "You are already on this plan and billing cycle"
      );
    }

    // Update subscription
    const now = new Date();
    const periodEnd = new Date(now);
    if (billingCycle === "annual") {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    subscription.plan = newPlan as ISubscription["plan"];
    subscription.billingCycle = billingCycle;
    subscription.status = "active";
    subscription.currentPeriodStart = now;
    subscription.currentPeriodEnd = periodEnd;
    subscription.cancelAt = undefined;

    await subscription.save();

    return subscription;
  }

  /**
   * Cancel a subscription (set to cancel at period end).
   */
  static async cancelSubscription(userId: string): Promise<ISubscription> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BillingValidationError("Invalid user ID");
    }

    const subscription = await this.getSubscription(userId);

    if (subscription.plan === "developer") {
      throw new BillingValidationError(
        "Cannot cancel a free plan"
      );
    }

    subscription.cancelAt = subscription.currentPeriodEnd;
    subscription.status = "canceled";
    await subscription.save();

    return subscription;
  }

  /**
   * Get all available plans.
   */
  static getPlans(): PlanConfig[] {
    return getAllPlans();
  }

  /**
   * Handle Stripe webhook (stub).
   * In production, this would validate Stripe signatures and process events.
   */
  static async handleWebhook(
    _body: any,
    _signature: string
  ): Promise<{ received: boolean }> {
    // Stub: log that we received a webhook
    console.log("Stripe webhook received (stub)");
    return { received: true };
  }
}
