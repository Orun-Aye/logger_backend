import { CreateLogDto } from "../dtos/CreateLog.dto";
import { Log, LogLevel } from "../models/log.model";



export const getLogs = async (filters: {
  level?: LogLevel;
  message?: string;
  page?: number;
  limit?: number;
}) => {
  try {
    const { level, message, page = 1, limit = 10 } = filters;

    // Build query object
    const query: any = {};

    if (level) {
      query.level = level;
    }

    if (message) {
      query.message = { $regex: message, $options: "i" }; // Case-insensitive search
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      Log.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Log.countDocuments(query),
    ]);

    return {
      success: true,
      data: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error("Failed to fetch logs:", error);
    return {
      success: false,
      message: "Failed to fetch logs",
      error,
    };
  }
};
