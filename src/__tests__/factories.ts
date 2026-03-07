import { UserModel } from "../models/user.model";
import { ProjectModel } from "../models/project.model";
import { LogModel } from "../models/log.model";
import { AlertRuleModel } from "../models/alertRule.model";
import { AlertEventModel } from "../models/alertEvent.model";
import { SubscriptionModel } from "../models/subscription.model";
import { OrganizationModel } from "../models/organization.model";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Types } from "mongoose";

const TEST_PASSWORD = "TestPassword123!";
const JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-key-for-testing";

/**
 * Create a test user with hashed password.
 */
export const createTestUser = async (overrides: Record<string, any> = {}) => {
  const { rawPassword, ...rest } = overrides;
  const password = await bcrypt.hash(rawPassword || TEST_PASSWORD, 10);
  const userData: any = {
    email: `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`,
    firstName: "Test",
    lastName: "User",
    password,
    role: "developer",
    ...rest,
  };
  return UserModel.create(userData);
};

/**
 * Create a test project with a unique API key.
 */
export const createTestProject = async (
  userId: string | Types.ObjectId,
  overrides: Record<string, any> = {}
) => {
  return ProjectModel.create({
    name: `Test Project ${Date.now()}-${Math.random().toString(36).substring(7)}`,
    ownerId: userId,
    apiKey: `test-api-key-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    teamMembers: [{ user: userId, role: "admin" }],
    ...overrides,
  });
};

/**
 * Create a test log entry.
 */
export const createTestLog = async (
  projectId: string,
  overrides: Record<string, any> = {}
) => {
  return LogModel.create({
    projectId,
    timestamp: new Date().toISOString(),
    level: "info",
    message: `Test log message ${Date.now()}`,
    service: "test-service",
    environment: "test",
    ...overrides,
  });
};

/**
 * Create a test alert rule.
 */
export const createTestAlertRule = async (
  projectId: string | Types.ObjectId,
  overrides: Record<string, any> = {}
) => {
  return AlertRuleModel.create({
    projectId,
    name: `Test Alert Rule ${Date.now()}`,
    description: "Test alert rule description",
    condition: {
      level: "error",
    },
    isActive: true,
    notifyChannels: ["email"],
    ...overrides,
  });
};

/**
 * Create a test alert event.
 */
export const createTestAlertEvent = async (
  projectId: string | Types.ObjectId,
  overrides: Record<string, any> = {}
) => {
  return AlertEventModel.create({
    projectId,
    title: "Test Alert",
    message: "Test alert event message",
    severity: "warning",
    status: "active",
    triggeredAt: new Date(),
    ...overrides,
  });
};

/**
 * Create a test subscription.
 */
export const createTestSubscription = async (
  userId: string | Types.ObjectId,
  overrides: Record<string, any> = {}
) => {
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  return SubscriptionModel.create({
    userId,
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
    ...overrides,
  });
};

/**
 * Create a test organization.
 */
export const createTestOrganization = async (
  ownerId: string | Types.ObjectId,
  overrides: Record<string, any> = {}
) => {
  return OrganizationModel.create({
    name: `Test Org ${Date.now()}`,
    slug: `test-org-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    ownerId,
    members: [
      {
        user: ownerId,
        role: "owner",
        joinedAt: new Date(),
      },
    ],
    ...overrides,
  });
};

/**
 * Generate a JWT auth token for a test user.
 */
export const generateAuthToken = (userId: string | Types.ObjectId): string => {
  return jwt.sign({ userId: userId.toString() }, JWT_SECRET, {
    expiresIn: "1h",
  });
};

/**
 * Helper to get the raw test password for login tests.
 */
export const getTestPassword = () => TEST_PASSWORD;
