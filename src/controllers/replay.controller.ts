import { Request, Response } from 'express';
import { replayService } from '../services/replay.service';
import { AppError } from '../errors';

/** Far beyond any real session (a day of 10s segments is ~8,640) */
const MAX_SEGMENT_INDEX = 100_000;
const MAX_LOOKUP_SESSIONS = 100;

class ReplayController {
  /**
   * POST /:projectId/replay — Ingest replay events (API Key auth)
   */
  async ingestReplay(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const { sessionId, events, segmentIndex } = req.body;

      // The API key identifies the project; it must be the one in the URL
      if (req.projectId !== projectId) {
        res.status(403).json({ status: 'error', message: 'API key does not belong to this project' });
        return;
      }

      if (!sessionId || typeof sessionId !== 'string') {
        res.status(400).json({ status: 'error', message: 'sessionId is required' });
        return;
      }

      if (!Array.isArray(events) || events.length === 0) {
        res.status(400).json({ status: 'error', message: 'events array is required and must not be empty' });
        return;
      }

      if (
        segmentIndex !== undefined &&
        !(Number.isInteger(segmentIndex) && segmentIndex >= 0 && segmentIndex <= MAX_SEGMENT_INDEX)
      ) {
        res.status(400).json({
          status: 'error',
          message: `segmentIndex must be an integer from 0 to ${MAX_SEGMENT_INDEX}`,
        });
        return;
      }

      // Size and event-count caps are enforced in the service (413)
      const segment = await replayService.ingestSegment(projectId, sessionId, events, segmentIndex);

      res.status(201).json({
        status: 'success',
        data: {
          segmentIndex: segment.segmentIndex,
          eventCount: segment.eventCount,
        },
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ status: 'error', message: error.message, details: error.details });
        return;
      }
      res.status(500).json({ status: 'error', message: error.message || 'Failed to ingest replay data' });
    }
  }

  /**
   * GET /:projectId/replay/sessions — List replay sessions (JWT auth)
   */
  async listSessions(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await replayService.listReplaySessions(projectId, limit, offset);

      res.json({
        status: 'success',
        data: result.sessions,
        meta: {
          total: result.total,
          limit,
          offset,
        },
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to list sessions' });
    }
  }

  /**
   * GET /:projectId/replay/available?sessionIds=a,b — Which sessions have a
   * playable replay (JWT auth). Lets the dashboard show "Watch replay" only
   * where it works, without downloading any recordings.
   */
  async getAvailableReplays(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const raw = typeof req.query.sessionIds === 'string' ? req.query.sessionIds : '';
      const sessionIds = [...new Set(raw.split(',').map((id) => id.trim()).filter(Boolean))];

      if (sessionIds.length > MAX_LOOKUP_SESSIONS) {
        res.status(400).json({
          status: 'error',
          message: `Look up at most ${MAX_LOOKUP_SESSIONS} sessions at a time`,
        });
        return;
      }

      const available = await replayService.findSessionsWithReplay(projectId, sessionIds);
      res.json({ status: 'success', data: { sessionIds: available } });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to look up replays' });
    }
  }

  /**
   * GET /:projectId/replay/:sessionId — Get session segments (JWT auth)
   */
  async getSessionSegments(req: Request, res: Response): Promise<void> {
    try {
      const { projectId, sessionId } = req.params;

      const segments = await replayService.getSessionSegments(projectId, sessionId);

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
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to get session segments' });
    }
  }
  /**
   * DELETE /:projectId/replay/sessions/:sessionId — Delete a session (JWT auth)
   */
  async deleteSession(req: Request, res: Response): Promise<void> {
    try {
      const { projectId, sessionId } = req.params;

      const deletedCount = await replayService.deleteSession(projectId, sessionId);

      if (deletedCount === 0) {
        res.status(404).json({ status: 'error', message: 'No replay data found for this session' });
        return;
      }

      res.json({
        status: 'success',
        message: `Deleted ${deletedCount} replay segment(s)`,
        data: { deletedCount },
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to delete session' });
    }
  }
}

export const replayController = new ReplayController();
