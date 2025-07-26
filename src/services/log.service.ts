import { CreateLogDTO, FilterLogsDTO } from "../dtos/log.dto";
import { LogModel } from "../models/log.model";
import { Types, SortOrder } from "mongoose";

export enum LogLevel {
  TRACE = "trace",
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
  FATAL = "fatal",
}

export type LogSortByField =
  | "timestamp"
  | "level"
  | "service"
  | "environment"
  | "createdAt"
  | "updatedAt";

export class LogNotFoundError extends Error {
  constructor(id: string) {
    super(`Log with ID ${id} not found`);
    this.name = "LogNotFoundError";
  }
}

export class LogServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LogServiceError";
  }
}

export class LogService {
  static async createLog(data: CreateLogDTO) {
    try {
      const existingLog = await LogModel.findOne({
        projectId: data.projectId,
        message: data.message,
        timestamp: data.timestamp,
      });

      if (existingLog) {
        throw new LogServiceError(
          "Log already exists with the same message and timestamp."
        );
      }

      const newLog = await LogModel.create({
        ...data,
        timestamp: data.timestamp || new Date(),
      });

      return newLog;
    } catch (error) {
      if (
        error instanceof LogNotFoundError ||
        error instanceof LogServiceError
      ) {
        throw error;
      }
      throw new Error(`Failed to record log: ${error}`);
    }
  }

  static async getAllLogs(filters: FilterLogsDTO) {
    try {
      const {
        level,
        service,
        environment,
        search,
        startDate,
        endDate,
        page = 1,
        limit = 50,
        sortBy = "timestamp",
        sortOrder = "desc",
      } = filters;

      const query: any = {};
      if (level) query.level = level;
      if (service) query.service = service;
      if (environment) query.environment = environment;
      if (search) query.message = { $regex: search, $options: "i" };
      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) query.timestamp.$lte = new Date(endDate);
      }

      const skip = (page - 1) * limit;
      const sort: { [key: string]: SortOrder } = {
        [sortBy]: sortOrder === "asc" ? 1 : -1,
      };

      const [logs, total] = await Promise.all([
        LogModel.find(query)
          .select("-__v")
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        LogModel.countDocuments(),
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
    } catch (error) {
      throw new LogServiceError(`Failed to fetch logs: ${error}`);
    }
  }

  static async getLogById(id: string) {
    try {
       if (!Types.ObjectId.isValid(id)) return null;
      const log = await LogModel.findById(id).select("-__v").lean()

      if (!log) {
        throw new LogNotFoundError(id)
      }

      return log
    } catch (error) {
      if (error instanceof LogNotFoundError ||
        error instanceof LogServiceError
      ) {
        throw error;
      }
      throw new Error(`Failed to fetch log: ${error}`)
    }
  }

  async getSummary() {
    const totalLogs = await LogModel.countDocuments();

    const byLevel = await LogModel.aggregate([
      { $group: { _id: "$level", count: { $sum: 1 } } },
    ]);

    const byService = await LogModel.aggregate([
      { $group: { _id: "$service", count: { $sum: 1 } } },
    ]);

    const byEnvironment = await LogModel.aggregate([
      { $group: { _id: "$environment", count: { $sum: 1 } } },
    ]);

    return {
      totalLogs,
      byLevel: Object.fromEntries(byLevel.map((l) => [l._id, l.count])),
      byService: Object.fromEntries(byService.map((s) => [s._id, s.count])),
      byEnvironment: Object.fromEntries(
        byEnvironment.map((e) => [e._id, e.count])
      ),
    };
  }
}
