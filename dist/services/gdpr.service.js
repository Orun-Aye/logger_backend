"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GdprService = void 0;
const archiver_1 = __importDefault(require("archiver"));
const user_model_1 = require("../models/user.model");
const project_model_1 = require("../models/project.model");
const log_model_1 = require("../models/log.model");
const alertRule_model_1 = require("../models/alertRule.model");
const alertEvent_model_1 = require("../models/alertEvent.model");
const userPreference_model_1 = require("../models/userPreference.model");
const apiToken_model_1 = require("../models/apiToken.model");
const savedSearch_model_1 = require("../models/savedSearch.model");
const logger_1 = __importDefault(require("../utils/logger"));
class GdprService {
    /**
     * Export all user data as a ZIP archive stream.
     * Excludes sensitive fields: password, OAuth tokens, reset tokens.
     */
    static async exportUserData(userId) {
        const user = await user_model_1.UserModel.findById(userId)
            .select("-password -accessToken -refreshToken -resetPasswordToken -resetPasswordExpires")
            .lean();
        if (!user) {
            throw new Error("User not found");
        }
        const archive = (0, archiver_1.default)("zip", { zlib: { level: 9 } });
        // 1. User profile
        archive.append(JSON.stringify(user, null, 2), { name: "profile.json" });
        // 2. Projects owned by user
        const projects = await project_model_1.ProjectModel.find({ ownerId: userId }).lean();
        archive.append(JSON.stringify(projects, null, 2), {
            name: "projects.json",
        });
        // 3. Logs from user's projects (last 90 days, capped at 50k)
        const projectIds = projects.map((p) => p._id);
        if (projectIds.length > 0) {
            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
            const logs = await log_model_1.LogModel.find({
                projectId: { $in: projectIds.map((id) => id.toString()) },
                createdAt: { $gte: ninetyDaysAgo },
            })
                .sort({ timestamp: -1 })
                .limit(50000)
                .lean();
            archive.append(JSON.stringify(logs, null, 2), { name: "logs.json" });
        }
        // 4. Alert rules from user's projects
        if (projectIds.length > 0) {
            const alertRules = await alertRule_model_1.AlertRuleModel.find({
                projectId: { $in: projectIds },
            }).lean();
            archive.append(JSON.stringify(alertRules, null, 2), {
                name: "alert-rules.json",
            });
        }
        // 5. Alert events from user's projects
        if (projectIds.length > 0) {
            const alertEvents = await alertEvent_model_1.AlertEventModel.find({
                projectId: { $in: projectIds },
            })
                .limit(10000)
                .lean();
            archive.append(JSON.stringify(alertEvents, null, 2), {
                name: "alerts.json",
            });
        }
        // 6. User preferences
        const preferences = await userPreference_model_1.UserPreferenceModel.find({ userId }).lean();
        archive.append(JSON.stringify(preferences, null, 2), {
            name: "preferences.json",
        });
        // 7. Saved searches
        const savedSearches = await savedSearch_model_1.SavedSearchModel.find({ userId }).lean();
        archive.append(JSON.stringify(savedSearches, null, 2), {
            name: "saved-searches.json",
        });
        // 8. API tokens (exclude hash for security)
        const apiTokens = await apiToken_model_1.ApiTokenModel.find({ userId })
            .select("-tokenHash")
            .lean();
        archive.append(JSON.stringify(apiTokens, null, 2), {
            name: "api-tokens.json",
        });
        // 9. Export metadata
        archive.append(JSON.stringify({
            exportedAt: new Date().toISOString(),
            userId,
            email: user.email,
            dataTypes: [
                "profile",
                "projects",
                "logs",
                "alert-rules",
                "alerts",
                "preferences",
                "saved-searches",
                "api-tokens",
            ],
            notes: "Logs are limited to the last 90 days and capped at 50,000 entries.",
        }, null, 2), { name: "metadata.json" });
        archive.finalize();
        return {
            archive,
            filename: `apperio-data-export-${userId}-${Date.now()}.zip`,
        };
    }
    /**
     * Delete all user data with cascade cleanup.
     * Order: dependent data first, then projects, then user-level data, then user.
     */
    static async deleteUserData(userId) {
        const user = await user_model_1.UserModel.findById(userId);
        if (!user) {
            throw new Error("User not found");
        }
        // Get all projects owned by user
        const projects = await project_model_1.ProjectModel.find({ ownerId: userId });
        const projectIds = projects.map((p) => p._id);
        const projectIdStrings = projectIds.map((id) => id.toString());
        let deletedLogs = 0;
        let deletedAlertRules = 0;
        let deletedAlertEvents = 0;
        // Delete project-scoped data
        if (projectIds.length > 0) {
            // Delete logs (projectId stored as string in log model)
            const logResult = await log_model_1.LogModel.deleteMany({
                projectId: { $in: projectIdStrings },
            });
            deletedLogs = logResult.deletedCount || 0;
            // Delete alert events
            const alertEventResult = await alertEvent_model_1.AlertEventModel.deleteMany({
                projectId: { $in: projectIds },
            });
            deletedAlertEvents = alertEventResult.deletedCount || 0;
            // Delete alert rules
            const alertRuleResult = await alertRule_model_1.AlertRuleModel.deleteMany({
                projectId: { $in: projectIds },
            });
            deletedAlertRules = alertRuleResult.deletedCount || 0;
            // Delete saved searches for user's projects
            await savedSearch_model_1.SavedSearchModel.deleteMany({
                projectId: { $in: projectIds },
            });
            // Delete the projects
            await project_model_1.ProjectModel.deleteMany({ ownerId: userId });
        }
        // Also remove user from any projects they are a team member of
        await project_model_1.ProjectModel.updateMany({ "teamMembers.user": userId }, { $pull: { teamMembers: { user: userId } } });
        // Delete user-scoped data
        await userPreference_model_1.UserPreferenceModel.deleteMany({ userId });
        await apiToken_model_1.ApiTokenModel.deleteMany({ userId });
        await savedSearch_model_1.SavedSearchModel.deleteMany({ userId }); // Any remaining saved searches
        // Finally delete the user
        await user_model_1.UserModel.findByIdAndDelete(userId);
        logger_1.default.info("GDPR: User data deleted", {
            userId,
            deletedProjects: projectIds.length,
            deletedLogs,
            deletedAlertRules,
            deletedAlertEvents,
        });
        return {
            deletedUser: true,
            deletedProjects: projectIds.length,
            deletedLogs,
            deletedAlertRules,
            deletedAlertEvents,
        };
    }
}
exports.GdprService = GdprService;
