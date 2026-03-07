import { Request, Response } from "express";
import { ChangelogService } from "../services/changelog.service";

export class ChangelogController {
  /**
   * GET /api/v1/public/changelog
   * Returns paginated changelog entries with optional category filter.
   * No authentication required.
   */
  static async getChangelogs(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const category = req.query.category as string | undefined;

      const result = await ChangelogService.getChangelogs({
        page,
        limit,
        category,
      });

      res.status(200).json({
        status: "success",
        data: result.entries,
        meta: result.meta,
      });
    } catch (error) {
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
  static async createChangelog(req: Request, res: Response): Promise<void> {
    try {
      const { version, title, date, category, description, highlights, author } =
        req.body;

      if (!version || !title || !category || !description) {
        res.status(400).json({
          status: "error",
          message:
            "Missing required fields: version, title, category, description",
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

      const entry = await ChangelogService.createChangelog({
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
    } catch (error) {
      console.error("ChangelogController Error:", error);
      res.status(500).json({
        status: "error",
        message: "Failed to create changelog entry",
      });
    }
  }
}
