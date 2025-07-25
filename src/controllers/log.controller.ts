import {  Response, Request } from "express-serve-static-core";
import { LogService } from "../services/log.service";
import { LogDTO } from "../dtos/log.dto";

/**
 * Controller for handling log-related HTTP requests.
 */
export class LogController {
  /**
   * POST /api/v1/logs
   * Accepts single or batch log entries.
   */
  static async ingestLogs(
    req: Request,
    res: Response
  ): Promise<void> {
    const projectId = res.locals.projectId; // Set by API key middleware
    let logs: LogDTO[] = Array.isArray(req.body) ? req.body : [req.body];

    try {
      const count = await LogService.ingestLogs(projectId, logs);
      res.status(202).json({
        status: "success",
        message: "Logs accepted for processing.",
        receivedCount: count,
      });
    } catch (err) {
      console.error("Log ingestion error:", err);
      res.status(500).json({
        status: "error",
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred on the server.",
      });
    }
  }

  // Returns filtered logs for a project
  static async getLogs(req: Request, res: Response): Promise<void> {
    const projectId = res.locals.projectId;
    const { level, startDate, endDate, source, search } = req.query;

    try {
      const logs = await LogService.queryLogs(projectId, {
        level: level as string,
        source: source as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        search: search as string,
      });

      res.status(200).json({
        status: "success",
        data: logs,
        count: logs.length,
      });
    } catch (error) {
      console.error("Error querying logs:", error);
      res.status(500).json({
        status: "error",
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve logs.",
      });
    }
  }
}
