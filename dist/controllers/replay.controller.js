"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replayController = void 0;
const replay_service_1 = require("../services/replay.service");
class ReplayController {
    /**
     * POST /:projectId/replay — Ingest replay events (API Key auth)
     */
    async ingestReplay(req, res) {
        try {
            const { projectId } = req.params;
            const { sessionId, events } = req.body;
            if (!sessionId || typeof sessionId !== 'string') {
                res.status(400).json({ status: 'error', message: 'sessionId is required' });
                return;
            }
            if (!Array.isArray(events) || events.length === 0) {
                res.status(400).json({ status: 'error', message: 'events array is required and must not be empty' });
                return;
            }
            // 5MB size guard
            const payloadSize = JSON.stringify(events).length;
            if (payloadSize > 5 * 1024 * 1024) {
                res.status(413).json({ status: 'error', message: 'Payload too large. Max 5MB per segment.' });
                return;
            }
            const segment = await replay_service_1.replayService.ingestSegment(projectId, sessionId, events);
            res.status(201).json({
                status: 'success',
                data: {
                    segmentIndex: segment.segmentIndex,
                    eventCount: segment.eventCount,
                },
            });
        }
        catch (error) {
            res.status(500).json({ status: 'error', message: error.message || 'Failed to ingest replay data' });
        }
    }
    /**
     * GET /:projectId/replay/sessions — List replay sessions (JWT auth)
     */
    async listSessions(req, res) {
        try {
            const { projectId } = req.params;
            const limit = Math.min(parseInt(req.query.limit) || 20, 100);
            const offset = parseInt(req.query.offset) || 0;
            const result = await replay_service_1.replayService.listReplaySessions(projectId, limit, offset);
            res.json({
                status: 'success',
                data: result.sessions,
                meta: {
                    total: result.total,
                    limit,
                    offset,
                },
            });
        }
        catch (error) {
            res.status(500).json({ status: 'error', message: error.message || 'Failed to list sessions' });
        }
    }
    /**
     * GET /:projectId/replay/:sessionId — Get session segments (JWT auth)
     */
    async getSessionSegments(req, res) {
        try {
            const { projectId, sessionId } = req.params;
            const segments = await replay_service_1.replayService.getSessionSegments(projectId, sessionId);
            if (segments.length === 0) {
                res.status(404).json({ status: 'error', message: 'No replay data found for this session' });
                return;
            }
            res.json({
                status: 'success',
                data: segments,
                meta: {
                    segmentCount: segments.length,
                    totalEvents: segments.reduce((sum, s) => sum + s.eventCount, 0),
                },
            });
        }
        catch (error) {
            res.status(500).json({ status: 'error', message: error.message || 'Failed to get session segments' });
        }
    }
    /**
     * DELETE /:projectId/replay/sessions/:sessionId — Delete a session (JWT auth)
     */
    async deleteSession(req, res) {
        try {
            const { projectId, sessionId } = req.params;
            const deletedCount = await replay_service_1.replayService.deleteSession(projectId, sessionId);
            if (deletedCount === 0) {
                res.status(404).json({ status: 'error', message: 'No replay data found for this session' });
                return;
            }
            res.json({
                status: 'success',
                message: `Deleted ${deletedCount} replay segment(s)`,
                data: { deletedCount },
            });
        }
        catch (error) {
            res.status(500).json({ status: 'error', message: error.message || 'Failed to delete session' });
        }
    }
}
exports.replayController = new ReplayController();
