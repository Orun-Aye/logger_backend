// src/config/plans.config.ts

export interface PlanLimits {
  maxLogs: number; // per month, -1 = unlimited
  maxProjects: number; // -1 = unlimited
  maxTeamMembers: number; // -1 = unlimited
  retentionDays: number;
  maxAlertRules: number; // -1 = unlimited
  maxApiTokens: number; // -1 = unlimited
  aiInsights: "none" | "basic" | "full";
  aiInsightsPerDay: number; // 0 = none, -1 = unlimited
  anomalyDetection: boolean;
  auditLogDays: number; // 0 = disabled
  mfa: "none" | "optional" | "enforced";
}

export interface PlanConfig {
  id: string;
  name: string;
  monthlyPrice: number; // in cents, 0 = free
  annualPrice: number; // in cents per month (billed annually)
  limits: PlanLimits;
  features: string[]; // for display
  support: string;
}

export type PlanId =
  | "developer"
  | "starter"
  | "professional"
  | "team"
  | "enterprise";

export const PLANS: Record<PlanId, PlanConfig> = {
  developer: {
    id: "developer",
    name: "Developer",
    monthlyPrice: 0,
    annualPrice: 0,
    limits: {
      maxLogs: 25_000,
      maxProjects: 2,
      maxTeamMembers: 1,
      retentionDays: 7,
      maxAlertRules: 3,
      maxApiTokens: 1,
      aiInsights: "none",
      aiInsightsPerDay: 0,
      anomalyDetection: false,
      auditLogDays: 0,
      mfa: "none",
    },
    features: [
      "25,000 logs/month",
      "2 projects",
      "7-day retention",
      "3 alert rules",
      "Community support",
    ],
    support: "Community",
  },

  starter: {
    id: "starter",
    name: "Starter",
    monthlyPrice: 900, // $9/mo
    annualPrice: 700, // $7/mo billed annually
    limits: {
      maxLogs: 250_000,
      maxProjects: 5,
      maxTeamMembers: 3,
      retentionDays: 14,
      maxAlertRules: 15,
      maxApiTokens: 3,
      aiInsights: "basic",
      aiInsightsPerDay: 5,
      anomalyDetection: false,
      auditLogDays: 0,
      mfa: "none",
    },
    features: [
      "250,000 logs/month",
      "5 projects",
      "3 team members",
      "14-day retention",
      "15 alert rules",
      "Basic AI Insights (5/day)",
      "Email support (48h)",
    ],
    support: "Email (48h)",
  },

  professional: {
    id: "professional",
    name: "Professional",
    monthlyPrice: 2_900, // $29/mo
    annualPrice: 2_300, // $23/mo billed annually
    limits: {
      maxLogs: 2_000_000,
      maxProjects: 15,
      maxTeamMembers: 10,
      retentionDays: 30,
      maxAlertRules: -1,
      maxApiTokens: 10,
      aiInsights: "full",
      aiInsightsPerDay: -1,
      anomalyDetection: true,
      auditLogDays: 0,
      mfa: "optional",
    },
    features: [
      "2,000,000 logs/month",
      "15 projects",
      "10 team members",
      "30-day retention",
      "Unlimited alert rules",
      "Full AI Insights",
      "Anomaly detection",
      "Optional MFA",
      "Email support (24h)",
    ],
    support: "Email (24h)",
  },

  team: {
    id: "team",
    name: "Team",
    monthlyPrice: 7_900, // $79/mo
    annualPrice: 6_300, // $63/mo billed annually
    limits: {
      maxLogs: 15_000_000,
      maxProjects: -1,
      maxTeamMembers: 25,
      retentionDays: 90,
      maxAlertRules: -1,
      maxApiTokens: -1,
      aiInsights: "full",
      aiInsightsPerDay: -1,
      anomalyDetection: true,
      auditLogDays: 30,
      mfa: "enforced",
    },
    features: [
      "15,000,000 logs/month",
      "Unlimited projects",
      "25 team members",
      "90-day retention",
      "Unlimited alert rules",
      "Full AI Insights",
      "Anomaly detection",
      "30-day audit log",
      "Enforced MFA",
      "Priority support (4h)",
    ],
    support: "Priority (4h)",
  },

  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    monthlyPrice: -1, // custom pricing
    annualPrice: -1,
    limits: {
      maxLogs: -1,
      maxProjects: -1,
      maxTeamMembers: -1,
      retentionDays: 365,
      maxAlertRules: -1,
      maxApiTokens: -1,
      aiInsights: "full",
      aiInsightsPerDay: -1,
      anomalyDetection: true,
      auditLogDays: 365,
      mfa: "enforced",
    },
    features: [
      "Unlimited logs",
      "Unlimited projects",
      "Unlimited team members",
      "365-day retention",
      "Unlimited everything",
      "Full AI + custom models",
      "Anomaly detection",
      "365-day audit log",
      "Enforced MFA + SSO",
      "Dedicated CSM",
    ],
    support: "Dedicated CSM",
  },
};

/**
 * Get plan config by plan ID. Returns developer plan if not found.
 */
export function getPlanConfig(planId: string): PlanConfig {
  return PLANS[planId as PlanId] || PLANS.developer;
}

/**
 * Get all plans as an array sorted by price.
 */
export function getAllPlans(): PlanConfig[] {
  return Object.values(PLANS);
}

/**
 * Check if a value exceeds a plan limit.
 * Returns true if the limit is unlimited (-1) or current < limit.
 */
export function isWithinLimit(current: number, limit: number): boolean {
  if (limit === -1) return true;
  return current < limit;
}

/**
 * Calculate usage percentage. Returns 0 for unlimited limits.
 */
export function getUsagePercentage(current: number, limit: number): number {
  if (limit === -1) return 0;
  if (limit === 0) return current > 0 ? 100 : 0;
  return Math.round((current / limit) * 100);
}
