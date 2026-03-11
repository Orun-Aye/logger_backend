"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.replayService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const replayEvent_model_1 = require("../models/replayEvent.model");
class ReplayService {
    /**
     * Ingest a batch of replay events as a numbered segment
     */
    async ingestSegment(projectId, sessionId, events) {
        if (!events || events.length === 0) {
            throw new Error('No events provided');
        }
        // Determine segment index (next in sequence)
        const lastSegment = await replayEvent_model_1.ReplaySegmentModel.findOne({ projectId: new mongoose_1.default.Types.ObjectId(projectId), sessionId }, { segmentIndex: 1 }, { sort: { segmentIndex: -1 } }).lean();
        const segmentIndex = lastSegment ? lastSegment.segmentIndex + 1 : 0;
        // Extract timestamps from events
        const timestamps = events
            .map((e) => e.timestamp)
            .filter((t) => typeof t === 'number');
        const startTimestamp = timestamps.length > 0 ? Math.min(...timestamps) : Date.now();
        const endTimestamp = timestamps.length > 0 ? Math.max(...timestamps) : Date.now();
        const segment = await replayEvent_model_1.ReplaySegmentModel.create({
            projectId: new mongoose_1.default.Types.ObjectId(projectId),
            sessionId,
            segmentIndex,
            events,
            startTimestamp,
            endTimestamp,
            eventCount: events.length,
        });
        return segment;
    }
    /**
     * Get all segments for a session, ordered by segment index
     */
    async getSessionSegments(projectId, sessionId) {
        return replayEvent_model_1.ReplaySegmentModel.find({ projectId: new mongoose_1.default.Types.ObjectId(projectId), sessionId })
            .sort({ segmentIndex: 1 })
            .lean();
    }
    /**
     * Delete all replay data for a session
     */
    async deleteSession(projectId, sessionId) {
        const result = await replayEvent_model_1.ReplaySegmentModel.deleteMany({
            projectId: new mongoose_1.default.Types.ObjectId(projectId),
            sessionId,
        });
        return result.deletedCount;
    }
    /**
     * List replay sessions with stats for a project
     */
    async listReplaySessions(projectId, limit = 20, offset = 0) {
        const pid = new mongoose_1.default.Types.ObjectId(projectId);
        const [sessions, totalResult] = await Promise.all([
            replayEvent_model_1.ReplaySegmentModel.aggregate([
                { $match: { projectId: pid } },
                {
                    $group: {
                        _id: '$sessionId',
                        segmentCount: { $sum: 1 },
                        totalEvents: { $sum: '$eventCount' },
                        startTimestamp: { $min: '$startTimestamp' },
                        endTimestamp: { $max: '$endTimestamp' },
                        createdAt: { $min: '$createdAt' },
                    },
                },
                { $sort: { createdAt: -1 } },
                { $skip: offset },
                { $limit: limit },
                {
                    $project: {
                        _id: 0,
                        sessionId: '$_id',
                        segmentCount: 1,
                        totalEvents: 1,
                        startTimestamp: 1,
                        endTimestamp: 1,
                        createdAt: 1,
                    },
                },
            ]),
            replayEvent_model_1.ReplaySegmentModel.aggregate([
                { $match: { projectId: pid } },
                { $group: { _id: '$sessionId' } },
                { $count: 'total' },
            ]),
        ]);
        return {
            sessions,
            total: totalResult[0]?.total || 0,
        };
    }
}
exports.replayService = new ReplayService();
