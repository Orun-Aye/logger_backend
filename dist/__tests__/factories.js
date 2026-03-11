"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTestPassword = exports.generateAuthToken = exports.createTestOrganization = exports.createTestSubscription = exports.createTestAlertEvent = exports.createTestAlertRule = exports.createTestLog = exports.createTestProject = exports.createTestUser = void 0;
const user_model_1 = require("../models/user.model");
const project_model_1 = require("../models/project.model");
const log_model_1 = require("../models/log.model");
const alertRule_model_1 = require("../models/alertRule.model");
const alertEvent_model_1 = require("../models/alertEvent.model");
const subscription_model_1 = require("../models/subscription.model");
const organization_model_1 = require("../models/organization.model");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const TEST_PASSWORD = "TestPassword123!";
const JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-key-for-testing";
/**
 * Create a test user with hashed password.
 */
const createTestUser = async (overrides = {}) => {
    const { rawPassword, ...rest } = overrides;
    const password = await bcrypt_1.default.hash(rawPassword || TEST_PASSWORD, 10);
    const userData = {
        email: `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`,
        firstName: "Test",
        lastName: "User",
        password,
        role: "developer",
        ...rest,
    };
    return user_model_1.UserModel.create(userData);
};
exports.createTestUser = createTestUser;
/**
 * Create a test project with a unique API key.
 */
const createTestProject = async (userId, overrides = {}) => {
    return project_model_1.ProjectModel.create({
        name: `Test Project ${Date.now()}-${Math.random().toString(36).substring(7)}`,
        ownerId: userId,
        apiKey: `test-api-key-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        teamMembers: [{ user: userId, role: "admin" }],
        ...overrides,
    });
};
exports.createTestProject = createTestProject;
/**
 * Create a test log entry.
 */
const createTestLog = async (projectId, overrides = {}) => {
    return log_model_1.LogModel.create({
        projectId,
        timestamp: new Date().toISOString(),
        level: "info",
        message: `Test log message ${Date.now()}`,
        service: "test-service",
        environment: "test",
        ...overrides,
    });
};
exports.createTestLog = createTestLog;
/**
 * Create a test alert rule.
 */
const createTestAlertRule = async (projectId, overrides = {}) => {
    return alertRule_model_1.AlertRuleModel.create({
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
exports.createTestAlertRule = createTestAlertRule;
/**
 * Create a test alert event.
 */
const createTestAlertEvent = async (projectId, overrides = {}) => {
    return alertEvent_model_1.AlertEventModel.create({
        projectId,
        title: "Test Alert",
        message: "Test alert event message",
        severity: "warning",
        status: "active",
        triggeredAt: new Date(),
        ...overrides,
    });
};
exports.createTestAlertEvent = createTestAlertEvent;
/**
 * Create a test subscription.
 */
const createTestSubscription = async (userId, overrides = {}) => {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    return subscription_model_1.SubscriptionModel.create({
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
exports.createTestSubscription = createTestSubscription;
/**
 * Create a test organization.
 */
const createTestOrganization = async (ownerId, overrides = {}) => {
    return organization_model_1.OrganizationModel.create({
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
exports.createTestOrganization = createTestOrganization;
/**
 * Generate a JWT auth token for a test user.
 */
const generateAuthToken = (userId) => {
    return jsonwebtoken_1.default.sign({ userId: userId.toString() }, JWT_SECRET, {
        expiresIn: "1h",
    });
};
exports.generateAuthToken = generateAuthToken;
/**
 * Helper to get the raw test password for login tests.
 */
const getTestPassword = () => TEST_PASSWORD;
exports.getTestPassword = getTestPassword;
