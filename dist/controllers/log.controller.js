"use strict";
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
/**
 * Controller for handling log-related HTTP requests.
 */
class LogController {
    /**
     * POST /api/v1/logs
     * Accepts single or batch log entries.
     */
    static ingestLogs(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const projectId = req.projectId; // Set by API key middleware
            let logs = Array.isArray(req.body) ? req.body : [req.body];
            try {
                const count = yield log_service_1.LogService.ingestLogs(projectId, logs);
                res.status(202).json({
                    status: "success",
                    message: "Logs accepted for processing.",
                    receivedCount: count,
                });
            }
            catch (err) {
                console.error("Log ingestion error:", err);
                res.status(500).json({
                    status: "error",
                    code: "INTERNAL_SERVER_ERROR",
                    message: "An unexpected error occurred on the server.",
                });
            }
        });
    }
    // Returns filtered logs for a project
    static getLogs(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const projectId = req.projectId;
            const { level, startDate, endDate, source, search } = req.query;
            try {
                const logs = yield log_service_1.LogService.queryLogs(projectId, {
                    level: level,
                    source: source,
                    startDate: startDate ? new Date(startDate) : undefined,
                    endDate: endDate ? new Date(endDate) : undefined,
                    search: search,
                });
                res.status(200).json({
                    status: "success",
                    data: logs,
                    count: logs.length,
                });
            }
            catch (error) {
                console.error("Error querying logs:", error);
                res.status(500).json({
                    status: "error",
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to retrieve logs.",
                });
            }
        });
    }
}
exports.LogController = LogController;
