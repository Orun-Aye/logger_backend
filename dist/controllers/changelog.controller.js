"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangelogController = void 0;
const changelog_service_1 = require("../services/changelog.service");
class ChangelogController {
    /**
     * GET /api/v1/public/changelog
     * Returns paginated changelog entries with optional category filter.
     * No authentication required.
     */
    static async getChangelogs(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const category = req.query.category;
            const result = await changelog_service_1.ChangelogService.getChangelogs({
                page,
                limit,
                category,
            });
            res.status(200).json({
                status: "success",
                data: result.entries,
                meta: result.meta,
            });
        }
        catch (error) {
            console.error("ChangelogController Error:", error);
            res.status(500).json({
                status: "error",
                message: "Failed to retrieve changelog entries",
            });
        }
    }
    /**
     * POST /api/v1/admin/changelog
     * Create a new changelog entry. Requires admin authentication.
     */
    static async createChangelog(req, res) {
        try {
            const { version, title, date, category, description, highlights, author } = req.body;
            if (!version || !title || !category || !description) {
                res.status(400).json({
                    status: "error",
                    message: "Missing required fields: version, title, category, description",
                });
                return;
            }
            const validCategories = [
                "feature",
                "improvement",
                "bugfix",
                "security",
                "performance",
            ];
            if (!validCategories.includes(category)) {
                res.status(400).json({
                    status: "error",
                    message: `Invalid category. Must be one of: ${validCategories.join(", ")}`,
                });
                return;
            }
            const entry = await changelog_service_1.ChangelogService.createChangelog({
                version,
                title,
                date: date ? new Date(date) : new Date(),
                category,
                description,
                highlights: highlights || [],
                author,
            });
            res.status(201).json({
                status: "success",
                message: "Changelog entry created",
                data: entry,
            });
        }
        catch (error) {
            console.error("ChangelogController Error:", error);
            res.status(500).json({
                status: "error",
                message: "Failed to create changelog entry",
            });
        }
    }
}
exports.ChangelogController = ChangelogController;
