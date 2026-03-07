import archiver from "archiver";
import { UserModel } from "../models/user.model";
import { ProjectModel } from "../models/project.model";
import { LogModel } from "../models/log.model";
import { AlertRuleModel } from "../models/alertRule.model";
import { AlertEventModel } from "../models/alertEvent.model";
import { UserPreferenceModel } from "../models/userPreference.model";
import { ApiTokenModel } from "../models/apiToken.model";
import { CustomDashboardModel } from "../models/customDashboard.model";
import { SavedSearchModel } from "../models/savedSearch.model";
import logger from "../utils/logger";

export class GdprService {
  /**
   * Export all user data as a ZIP archive stream.
   * Excludes sensitive fields: password, OAuth tokens, reset tokens.
   */
  static async exportUserData(
    userId: string
  ): Promise<{ archive: archiver.Archiver; filename: string }> {
    const user = await UserModel.findById(userId)
      .select(
        "-password -accessToken -refreshToken -resetPasswordToken -resetPasswordExpires"
      )
      .lean();

    if (!user) {
      throw new Error("User not found");
    }

    const archive = archiver("zip", { zlib: { level: 9 } });

    // 1. User profile
    archive.append(JSON.stringify(user, null, 2), { name: "profile.json" });

    // 2. Projects owned by user
    const projects = await ProjectModel.find({ ownerId: userId }).lean();
    archive.append(JSON.stringify(projects, null, 2), {
      name: "projects.json",
    });

    // 3. Logs from user's projects (last 90 days, capped at 50k)
    const projectIds = projects.map((p) => p._id);
    if (projectIds.length > 0) {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const logs = await LogModel.find({
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
      const alertRules = await AlertRuleModel.find({
        projectId: { $in: projectIds },
      }).lean();
      archive.append(JSON.stringify(alertRules, null, 2), {
        name: "alert-rules.json",
      });
    }

    // 5. Alert events from user's projects
    if (projectIds.length > 0) {
      const alertEvents = await AlertEventModel.find({
        projectId: { $in: projectIds },
      })
        .limit(10000)
        .lean();
      archive.append(JSON.stringify(alertEvents, null, 2), {
        name: "alerts.json",
      });
    }

    // 6. User preferences
    const preferences = await UserPreferenceModel.find({ userId }).lean();
    archive.append(JSON.stringify(preferences, null, 2), {
      name: "preferences.json",
    });

    // 7. Custom dashboards
    const customDashboards = await CustomDashboardModel.find({
      userId,
    }).lean();
    archive.append(JSON.stringify(customDashboards, null, 2), {
      name: "custom-dashboards.json",
    });

    // 8. Saved searches
    const savedSearches = await SavedSearchModel.find({ userId }).lean();
    archive.append(JSON.stringify(savedSearches, null, 2), {
      name: "saved-searches.json",
    });

    // 9. API tokens (exclude hash for security)
    const apiTokens = await ApiTokenModel.find({ userId })
      .select("-tokenHash")
      .lean();
    archive.append(JSON.stringify(apiTokens, null, 2), {
      name: "api-tokens.json",
    });

    // 10. Export metadata
    archive.append(
      JSON.stringify(
        {
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
            "custom-dashboards",
            "saved-searches",
            "api-tokens",
          ],
          notes:
            "Logs are limited to the last 90 days and capped at 50,000 entries.",
        },
        null,
        2
      ),
      { name: "metadata.json" }
    );

    archive.finalize();

    return {
      archive,
      filename: `monita-data-export-${userId}-${Date.now()}.zip`,
    };
  }

  /**
   * Delete all user data with cascade cleanup.
   * Order: dependent data first, then projects, then user-level data, then user.
   */
  static async deleteUserData(userId: string): Promise<{
    deletedUser: boolean;
    deletedProjects: number;
    deletedLogs: number;
    deletedAlertRules: number;
    deletedAlertEvents: number;
  }> {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Get all projects owned by user
    const projects = await ProjectModel.find({ ownerId: userId });
    const projectIds = projects.map((p) => p._id);
    const projectIdStrings = projectIds.map((id) => id.toString());

    let deletedLogs = 0;
    let deletedAlertRules = 0;
    let deletedAlertEvents = 0;

    // Delete project-scoped data
    if (projectIds.length > 0) {
      // Delete logs (projectId stored as string in log model)
      const logResult = await LogModel.deleteMany({
        projectId: { $in: projectIdStrings },
      });
      deletedLogs = logResult.deletedCount || 0;

      // Delete alert events
      const alertEventResult = await AlertEventModel.deleteMany({
        projectId: { $in: projectIds },
      });
      deletedAlertEvents = alertEventResult.deletedCount || 0;

      // Delete alert rules
      const alertRuleResult = await AlertRuleModel.deleteMany({
        projectId: { $in: projectIds },
      });
      deletedAlertRules = alertRuleResult.deletedCount || 0;

      // Delete saved searches for user's projects
      await SavedSearchModel.deleteMany({
        projectId: { $in: projectIds },
      });

      // Delete the projects
      await ProjectModel.deleteMany({ ownerId: userId });
    }

    // Also remove user from any projects they are a team member of
    await ProjectModel.updateMany(
      { "teamMembers.user": userId },
      { $pull: { teamMembers: { user: userId } } }
    );

    // Delete user-scoped data
    await UserPreferenceModel.deleteMany({ userId });
    await ApiTokenModel.deleteMany({ userId });
    await CustomDashboardModel.deleteMany({ userId });
    await SavedSearchModel.deleteMany({ userId }); // Any remaining saved searches

    // Finally delete the user
    await UserModel.findByIdAndDelete(userId);

    logger.info("GDPR: User data deleted", {
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
