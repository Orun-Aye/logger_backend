"use strict";
// src/controllers/log.controller.ts
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogController = void 0;
const log_service_1 = require("../services/log.service");
class LogController {
    static handleError(error, res, defaultMessage) {
        console.error(`LogController Error: ${error.message}`, error.stack);
        if (error instanceof log_service_1.LogServiceError) {
            return res.status(400).json({
                status: "error",
                message: error.message,
                errors: [error.message],
            });
        }
        if (error instanceof log_service_1.LogNotFoundError) {
            return res.status(404).json({
                status: "error",
                message: error.message,
            });
        }
        // Database/MongoDB specific errors
        if (error.name === "ValidationError") {
            return res.status(400).json({
                status: "error",
                message: "Validation failed",
                errors: Object.values(error.errors).map((err) => err.message),
            });
        }
        if (error.name === "CastError") {
            return res.status(400).json({
                status: "error",
                message: "Invalid ID format",
            });
        }
        // Generic server error
        return res.status(500).json({
            status: "error",
            message: defaultMessage,
        });
    }
    static validatePaginationParams(req) {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10)); // Cap at 100
        // Define allowed sortBy fields explicitly
        const allowedSortBy = [
            "createdAt",
            "updatedAt",
            "timestamp",
            "level",
            "service",
        ];
        // Validate sortBy from query. If invalid, default to 'createdAt'.
        let sortBy = "createdAt"; // Default value
        if (req.query.sortBy &&
            typeof req.query.sortBy === "string" &&
            allowedSortBy.includes(req.query.sortBy)) {
            sortBy = req.query.sortBy;
        }
        // Validate sortOrder. Default to 'desc'.
        const sortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";
        // You can also extract other filter parameters here
        const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
        const level = typeof req.query.level === "string" &&
            Object.values(log_service_1.LogLevel).includes(req.query.level)
            ? req.query.level
            : undefined;
        const search = typeof req.query.search === "string" ? req.query.search : undefined;
        const startDate = typeof req.query.startDate === "string"
            ? new Date(req.query.startDate)
            : undefined;
        const endDate = typeof req.query.endDate === "string"
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
    static createLog(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const logData = req.body;
                const log = yield log_service_1.LogService.createLog(logData);
                return res.status(201).json({
                    status: "success",
                    data: log,
                });
            }
            catch (error) {
                return LogController.handleError(error, res, "Failed to create log entry");
            }
        });
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
    static getAllLogs(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const paginationParams = LogController.validatePaginationParams(req);
                const result = yield log_service_1.LogService.getAllLogs(paginationParams);
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
                });
            }
            catch (error) {
                return LogController.handleError(error, res, "Failed to fetch logs");
            }
        });
    }
    static getLogById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(req.params);
                const { logId } = req.params;
                const log = yield log_service_1.LogService.getLogById(logId);
                return res.status(200).json({
                    status: "success",
                    message: "Log fetched succesfully",
                    data: log,
                });
            }
            catch (error) {
                return LogController.handleError(error, res, "Failed to fetch log");
            }
        });
    }
}
exports.LogController = LogController;
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
