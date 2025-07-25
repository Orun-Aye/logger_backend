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
exports.LogService = void 0;
const log_model_1 = require("../models/log.model");
class LogService {
    static ingestLogs(projectId, logs) {
        return __awaiter(this, void 0, void 0, function* () {
            const documents = logs.map((log) => ({
                timestamp: log.timestamp ? new Date(log.timestamp) : new Date(),
                level: log.level,
                message: log.message,
                source: log.source,
                metadata: log.metadata || {},
                projectId,
            }));
            const result = yield log_model_1.LogModel.insertMany(documents);
            return result.length;
        });
    }
    // Query logs with filters.
    static queryLogs(projectId, filters) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = { projectId };
            if (filters.level) {
                query.level = filters.level;
            }
            if (filters.source) {
                query.source = filters.source;
            }
            if (filters.startDate) {
                query.timestamp = Object.assign(Object.assign({}, query.timestamp), { $gte: filters.startDate });
            }
            if (filters.endDate) {
                query.timestamp = Object.assign(Object.assign({}, query.timestamp), { $lte: filters.endDate });
            }
            if (filters.search) {
                query.$or = [
                    { message: { $regex: filters.search, $options: 'i' } },
                    { 'metadata': { $regex: filters.search, $options: 'i' } }
                ];
            }
            return log_model_1.LogModel.find(query).sort({ timestamp: -1 }).limit(200);
        });
    }
}
exports.LogService = LogService;
