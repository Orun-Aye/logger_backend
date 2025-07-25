import mongoose from "mongoose";
import { LogDTO } from "../dtos/log.dto";
import { LogModel } from "../models/log.model";

export class LogService {
  static async ingestLogs(projectId: mongoose.Types.ObjectId, logs: LogDTO[]): Promise<number> {
    const documents = logs.map((log) => ({
      timestamp: log.timestamp ? new Date(log.timestamp) : new Date(),
      level: log.level,
      message: log.message,
      source: log.source,
      metadata: log.metadata || {},
      projectId,
    }))

    const result = await LogModel.insertMany(documents);
    return result.length;
  }

  // Query logs with filters.
  static async queryLogs(
    projectId: mongoose.Types.ObjectId,
    filters: {
      level?: string;
      source?: string;
      startDate?: Date;
      endDate?: Date;
      search?: string
    }
  ) {
    const query: any = { projectId };
    
    if (filters.level) {
      query.level = filters.level;
    }
    if (filters.source) {
      query.source = filters.source;
    }
    if (filters.startDate) {
      query.timestamp = { ...query.timestamp, $gte: filters.startDate };
    }
    if (filters.endDate) {
      query.timestamp = { ...query.timestamp, $lte: filters.endDate };
    }
    if (filters.search) {
      query.$or = [
        { message: { $regex: filters.search, $options: 'i' } },
        { 'metadata': { $regex: filters.search, $options: 'i' } }
      ];
    }

    return LogModel.find(query).sort({ timestamp: -1 }).limit(200);
  }
}