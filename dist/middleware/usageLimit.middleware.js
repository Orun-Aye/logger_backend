"use strict";
// src/middleware/usageLimit.middleware.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkUsageLimit = checkUsageLimit;
const subscription_model_1 = require("../models/subscription.model");
const project_model_1 = require("../models/project.model");
const plans_config_1 = require("../config/plans.config");
const mongoose_1 = require("mongoose");
/**
 * Middleware that checks plan limits before allowing resource creation.
 *
 * For log ingestion: check logsIngested vs maxLogs
 * Soft limit behavior:
 *   90%  -> allow, set X-Usage-Warning header
 *   100% -> allow, set X-Usage-Exceeded header
 *   120% -> for non-error logs, apply sampling (random skip)
 * Always allow error/fatal logs through.
 *
 * For other resources: hard limit check (projects, teamMembers, etc.)
 */
function checkUsageLimit(resource) {
    return async (req, res, next) => {
        try {
            let userId;
            if (resource === "logsIngested") {
                // Log ingestion uses API key auth, so req.projectId is set but not req.userId.
                // We need to look up the project owner.
                const projectId = req.projectId || req.params.projectId;
                if (!projectId) {
                    return next(); // Can't check without project ID
                }
                const project = await project_model_1.ProjectModel.findById(projectId, {
                    ownerId: 1,
                }).lean();
                if (!project || !project.ownerId) {
                    return next(); // Can't check without owner
                }
                userId = project.ownerId.toString();
            }
            else {
                // For authenticated routes, req.userId is set by verifyToken
                userId = req.userId;
            }
            if (!userId || !mongoose_1.Types.ObjectId.isValid(userId)) {
                return next(); // Skip limit check if no valid user
            }
            // Get or create subscription
            let subscription = await subscription_model_1.SubscriptionModel.findOne({
                userId: new mongoose_1.Types.ObjectId(userId),
            });
            if (!subscription) {
                // Auto-create developer subscription
                const now = new Date();
                const periodEnd = new Date(now);
                periodEnd.setMonth(periodEnd.getMonth() + 1);
                subscription = await subscription_model_1.SubscriptionModel.create({
                    userId: new mongoose_1.Types.ObjectId(userId),
                    plan: "developer",
                    billingCycle: "monthly",
                    status: "active",
                    usage: { logsIngested: 0, apiCalls: 0, lastResetAt: now },
                    currentPeriodStart: now,
                    currentPeriodEnd: periodEnd,
                });
            }
            const planConfig = (0, plans_config_1.getPlanConfig)(subscription.plan);
            const limits = planConfig.limits;
            if (resource === "logsIngested") {
                const limit = limits.maxLogs;
                // Unlimited plan
                if (limit === -1) {
                    // Increment usage counter in background (don't await)
                    subscription_model_1.SubscriptionModel.updateOne({ _id: subscription._id }, { $inc: { "usage.logsIngested": 1 } }).exec();
                    return next();
                }
                const current = subscription.usage.logsIngested;
                const percentage = (0, plans_config_1.getUsagePercentage)(current, limit);
                // Check if this is an error/fatal log (always allowed)
                const logLevel = req.body?.level?.toLowerCase?.() || "";
                const isErrorLog = logLevel === "error" || logLevel === "fatal";
                if (percentage >= 120 && !isErrorLog) {
                    // Apply sampling: randomly skip ~50% of non-error logs
                    if (Math.random() > 0.5) {
                        res.setHeader("X-Usage-Sampled", "true");
                        return res.status(429).json({
                            status: "error",
                            message: "Log ingestion limit significantly exceeded. Upgrade your plan for higher limits.",
                            code: "USAGE_LIMIT_EXCEEDED",
                            usage: { current, limit, percentage },
                        });
                    }
                }
                if (percentage >= 100) {
                    res.setHeader("X-Usage-Exceeded", "true");
                    res.setHeader("X-Usage-Percentage", percentage.toString());
                }
                else if (percentage >= 90) {
                    res.setHeader("X-Usage-Warning", "true");
                    res.setHeader("X-Usage-Percentage", percentage.toString());
                }
                // Increment usage counter in background
                subscription_model_1.SubscriptionModel.updateOne({ _id: subscription._id }, { $inc: { "usage.logsIngested": 1 } }).exec();
                return next();
            }
            // For other resources, do a hard limit check
            const limitMap = {
                projects: limits.maxProjects,
                teamMembers: limits.maxTeamMembers,
                alertRules: limits.maxAlertRules,
                apiTokens: limits.maxApiTokens,
            };
            const limit = limitMap[resource];
            if (limit === undefined) {
                return next(); // Unknown resource, skip
            }
            // Unlimited
            if (limit === -1) {
                return next();
            }
            // For hard limits, we need to count the current usage
            // This is handled per-resource because the query varies
            let current = 0;
            const userObjId = new mongoose_1.Types.ObjectId(userId);
            switch (resource) {
                case "projects":
                    current = await project_model_1.ProjectModel.countDocuments({
                        ownerId: userObjId,
                        isActive: true,
                    });
                    break;
                case "teamMembers": {
                    const projects = await project_model_1.ProjectModel.find({ ownerId: userObjId, isActive: true }, { teamMembers: 1 }).lean();
                    const uniqueMembers = new Set();
                    for (const project of projects) {
                        if (project.teamMembers) {
                            for (const member of project.teamMembers) {
                                uniqueMembers.add(member.user.toString());
                            }
                        }
                    }
                    current = uniqueMembers.size;
                    break;
                }
                default:
                    // For alertRules, apiTokens we skip here
                    // as they are less critical. Let the service layer handle it.
                    return next();
            }
            if (current >= limit) {
                return res.status(403).json({
                    status: "error",
                    message: `Plan limit reached for ${resource}. Your ${planConfig.name} plan allows ${limit}. Upgrade to increase your limit.`,
                    code: "PLAN_LIMIT_REACHED",
                    usage: {
                        current,
                        limit,
                        percentage: (0, plans_config_1.getUsagePercentage)(current, limit),
                    },
                });
            }
            return next();
        }
        catch (error) {
            // Don't block requests on billing errors
            console.error("Usage limit middleware error:", error);
            return next();
        }
    };
}
