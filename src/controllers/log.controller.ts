// src/controllers/log.controller.ts

import { Request, Response } from "express";
import {
  LogNotFoundError,
  LogService,
  LogServiceError,
} from "../services/log.service";
import { FilterLogsDTO, LogLevel, LogSortByField } from "../dtos/log.dto";
import { SortOrder } from "mongoose";

interface ApiResponse<T = any> {
  status: "success" | "error";
  message?: string;
  data?: T;
  errors?: string[];
  meta?: any;
}

export class LogController {
  private static handleError(
    error: Error,
    res: Response,
    defaultMessage: string
  ): Response {
    console.error(`LogController Error: ${error.message}`, error.stack);

    if (error instanceof LogServiceError) {
      return res.status(400).json({
        status: "error",
        message: error.message,
        errors: [error.message],
      } as ApiResponse);
    }

    if (error instanceof LogNotFoundError) {
      return res.status(404).json({
        status: "error",
        message: error.message,
      } as ApiResponse);
    }

    // Database/MongoDB specific errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        status: "error",
        message: "Validation failed",
        errors: Object.values((error as any).errors).map(
          (err: any) => err.message
        ),
      } as ApiResponse);
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        status: "error",
        message: "Invalid ID format",
      } as ApiResponse);
    }

    // Generic server error
    return res.status(500).json({
      status: "error",
      message: defaultMessage,
    } as ApiResponse);
  }

  private static validatePaginationParams(req: Request): FilterLogsDTO {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit as string) || 10)
    ); // Cap at 100

    // Define allowed sortBy fields explicitly
    const allowedSortBy: LogSortByField[] = [
      "createdAt",
      "updatedAt",
      "timestamp",
      "level",
      "service",
    ];

    // Validate sortBy from query. If invalid, default to 'createdAt'.
    let sortBy: LogSortByField = "createdAt"; // Default value
    if (
      req.query.sortBy &&
      typeof req.query.sortBy === "string" &&
      allowedSortBy.includes(req.query.sortBy as LogSortByField)
    ) {
      sortBy = req.query.sortBy as LogSortByField;
    }

    // Validate sortOrder. Default to 'desc'.
    const sortOrder: SortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";

    // You can also extract other filter parameters here
    const projectId =
      typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    const level =
      typeof req.query.level === "string" &&
      Object.values(LogLevel).includes(req.query.level as LogLevel)
        ? (req.query.level as LogLevel)
        : undefined;
    const search =
      typeof req.query.search === "string" ? req.query.search : undefined;
    const startDate =
      typeof req.query.startDate === "string"
        ? new Date(req.query.startDate)
        : undefined;
    const endDate =
      typeof req.query.endDate === "string"
        ? new Date(req.query.endDate)
        : undefined;

    return {
      page,
      limit,
      sortBy,
      sortOrder,
      level,
      search,
      startDate,
      endDate,
    };
  }

  static async createLog(req: Request, res: Response): Promise<Response> {
    try {
      const logData = req.body;
      const log = await LogService.createLog(logData);

      return res.status(201).json({
        status: "success",
        data: log,
      } as ApiResponse);
    } catch (error) {
      return LogController.handleError(
        error as Error,
        res,
        "Failed to create log entry"
      );
    }
  }

  // static async createLogsBatch(req: Request, res: Response): Promise<Response> {
  //   try {
  //     const logs = req.body;
  //     const { projectId } = req.params;

  //     if (!Array.isArray(logs)) {
  //       return res.status(400).json({
  //         status: "error",
  //         message: "Request body must be an array of log entries",
  //       });
  //     }

  //     const logsWithProjectId = logs.map((log) => ({
  //       ...log,
  //       projectId,
  //     }));

  //     // Create all logs
  //     const createdLogs = await Promise.all(
  //       logsWithProjectId.map((logData) => LogService.createLog(logData))
  //     );

  //     return res.status(201).json({
  //       status: "success",
  //       data: createdLogs,
  //       message: `Successfully created ${createdLogs.length} log entries`,
  //     } as ApiResponse);
  //   } catch (error) {
  //     return LogController.handleError(
  //       error as Error,
  //       res,
  //       "Failed to create log entries"
  //     );
  //   }
  // }

  static async getAllLogs(req: Request, res: Response): Promise<Response> {
    try {
      const paginationParams = LogController.validatePaginationParams(req);
      const result = await LogService.getAllLogs(paginationParams);

      return res.status(200).json({
        status: "success",
        data: result.logs,
        meta: {
          pagination: result.pagination,
          page: paginationParams.page,
          limit: paginationParams.limit,
          sortBy: paginationParams.sortBy,
          sortOrder: paginationParams.sortOrder,
        },
      } as ApiResponse);
    } catch (error) {
      return LogController.handleError(
        error as Error,
        res,
        "Failed to fetch logs"
      );
    }
  }

  static async getLogById(req: Request, res: Response): Promise<Response> {
    try {
      console.log(req.params);
      const { logId } = req.params;
      const log = await LogService.getLogById(logId);

      return res.status(200).json({
        status: "success",
        message: "Log fetched succesfully",
        data: log,
      } as ApiResponse);
    } catch (error) {
      return LogController.handleError(
        error as Error,
        res,
        "Failed to fetch log"
      );
    }
  }
}

// export const LogController = {

//   async createLog(req: Request, res: Response) {
//     try {
//       const log = await logService.createLog(req.body);
//       return res.status(201).json(log);
//     } catch (err) {
//       console.error(err);
//       return res.status(500).json({ error: 'Failed to create log' });
//     }
//   },

//   async getLogs(req: Request, res: Response) {
//     try {
//       const logs = await logService.getLogs(req.query);
//       return res.status(200).json(logs);
//     } catch (err) {
//       console.error(err);
//       return res.status(500).json({ error: 'Failed to fetch logs' });
//     }
//   },

//   async getLogsByProjectId(req: Request, res: Response) {
//     try {
//       const logs = await logService.getLogsByProjectId(req.params.projectId, req.query);
//       return res.status(200).json(logs);
//     } catch (err) {
//       console.error(err);
//       return res.status(500).json({ error: 'Failed to fetch logs for project' });
//     }
//   },

//   async getLogById(req: Request, res: Response) {
//     try {
//       const log = await logService.getLogById(req.params.id);
//       if (!log) return res.status(404).json({ error: 'Log not found' });
//       return res.status(200).json(log);
//     } catch (err) {
//       console.error(err);
//       return res.status(500).json({ error: 'Failed to fetch log' });
//     }
//   },

//   async getSummary(req: Request, res: Response) {
//     try {
//       const summary = await logService.getSummary();
//       return res.status(200).json(summary);
//     } catch (err) {
//       console.error(err);
//       return res.status(500).json({ error: 'Failed to fetch summary' });
//     }
//   }
// };
