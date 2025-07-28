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
exports.LogService = exports.LogServiceError = exports.LogNotFoundError = exports.LogLevel = void 0;
const log_model_1 = require("../models/log.model");
const mongoose_1 = require("mongoose");
var LogLevel;
(function (LogLevel) {
    LogLevel["TRACE"] = "trace";
    LogLevel["DEBUG"] = "debug";
    LogLevel["INFO"] = "info";
    LogLevel["WARN"] = "warn";
    LogLevel["ERROR"] = "error";
    LogLevel["FATAL"] = "fatal";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class LogNotFoundError extends Error {
    constructor(id) {
        super(`Log with ID ${id} not found`);
        this.name = "LogNotFoundError";
    }
}
exports.LogNotFoundError = LogNotFoundError;
class LogServiceError extends Error {
    constructor(message) {
        super(message);
        this.name = "LogServiceError";
    }
}
exports.LogServiceError = LogServiceError;
class LogService {
    static createLog(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const existingLog = yield log_model_1.LogModel.findOne({
                    projectId: data.projectId,
                    message: data.message,
                    timestamp: data.timestamp,
                });
                if (existingLog) {
                    throw new LogServiceError("Log already exists with the same message and timestamp.");
                }
                const newLog = yield log_model_1.LogModel.create(Object.assign(Object.assign({}, data), { timestamp: data.timestamp || new Date() }));
                return newLog;
            }
            catch (error) {
                if (error instanceof LogNotFoundError ||
                    error instanceof LogServiceError) {
                    throw error;
                }
                throw new Error(`Failed to record log: ${error}`);
            }
        });
    }
    static getAllLogs(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { level, service, environment, search, startDate, endDate, page = 1, limit = 50, sortBy = "timestamp", sortOrder = "desc", } = filters;
                const query = {};
                if (level)
                    query.level = level;
                if (service)
                    query.service = service;
                if (environment)
                    query.environment = environment;
                if (search)
                    query.message = { $regex: search, $options: "i" };
                if (startDate || endDate) {
                    query.timestamp = {};
                    if (startDate)
                        query.timestamp.$gte = new Date(startDate);
                    if (endDate)
                        query.timestamp.$lte = new Date(endDate);
                }
                const skip = (page - 1) * limit;
                const sort = {
                    [sortBy]: sortOrder === "asc" ? 1 : -1,
                };
                const [logs, total] = yield Promise.all([
                    log_model_1.LogModel.find(query)
                        .select("-__v")
                        .sort(sort)
                        .skip(skip)
                        .limit(limit)
                        .lean(),
                    log_model_1.LogModel.countDocuments(),
                ]);
                return {
                    logs,
                    pagination: {
                        total: Math.ceil(total / limit),
                        current: page,
                        count: logs.length,
                        order: sortOrder,
                        totalRecords: total,
                    },
                };
            }
            catch (error) {
                throw new LogServiceError(`Failed to fetch logs: ${error}`);
            }
        });
    }
    static getLogById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!mongoose_1.Types.ObjectId.isValid(id))
                    return null;
                const log = yield log_model_1.LogModel.findById(id).select("-__v").lean();
                if (!log) {
                    throw new LogNotFoundError(id);
                }
                return log;
            }
            catch (error) {
                if (error instanceof LogNotFoundError ||
                    error instanceof LogServiceError) {
                    throw error;
                }
                throw new Error(`Failed to fetch log: ${error}`);
            }
        });
    }
    getSummary() {
        return __awaiter(this, void 0, void 0, function* () {
            const totalLogs = yield log_model_1.LogModel.countDocuments();
            const byLevel = yield log_model_1.LogModel.aggregate([
                { $group: { _id: "$level", count: { $sum: 1 } } },
            ]);
            const byService = yield log_model_1.LogModel.aggregate([
                { $group: { _id: "$service", count: { $sum: 1 } } },
            ]);
            const byEnvironment = yield log_model_1.LogModel.aggregate([
                { $group: { _id: "$environment", count: { $sum: 1 } } },
            ]);
            return {
                totalLogs,
                byLevel: Object.fromEntries(byLevel.map((l) => [l._id, l.count])),
                byService: Object.fromEntries(byService.map((s) => [s._id, s.count])),
                byEnvironment: Object.fromEntries(byEnvironment.map((e) => [e._id, e.count])),
            };
        });
    }
}
exports.LogService = LogService;
