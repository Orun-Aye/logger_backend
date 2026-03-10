import mongoose from 'mongoose';
import { ReplaySegmentModel, IReplaySegment } from '../models/replayEvent.model';

class ReplayService {
  /**
   * Ingest a batch of replay events as a numbered segment
   */
  async ingestSegment(
    projectId: string,
    sessionId: string,
    events: any[]
  ): Promise<IReplaySegment> {
    if (!events || events.length === 0) {
      throw new Error('No events provided');
    }

    // Determine segment index (next in sequence)
    const lastSegment = await ReplaySegmentModel.findOne(
      { projectId: new mongoose.Types.ObjectId(projectId), sessionId },
      { segmentIndex: 1 },
      { sort: { segmentIndex: -1 } }
    ).lean();

    const segmentIndex = lastSegment ? lastSegment.segmentIndex + 1 : 0;

    // Extract timestamps from events
    const timestamps = events
      .map((e: any) => e.timestamp)
      .filter((t: any) => typeof t === 'number');
    const startTimestamp = timestamps.length > 0 ? Math.min(...timestamps) : Date.now();
    const endTimestamp = timestamps.length > 0 ? Math.max(...timestamps) : Date.now();

    const segment = await ReplaySegmentModel.create({
      projectId: new mongoose.Types.ObjectId(projectId),
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
  async getSessionSegments(
    projectId: string,
    sessionId: string
  ): Promise<IReplaySegment[]> {
    return ReplaySegmentModel.find(
      { projectId: new mongoose.Types.ObjectId(projectId), sessionId }
    )
      .sort({ segmentIndex: 1 })
      .lean();
  }

  /**
   * Delete all replay data for a session
   */
  async deleteSession(projectId: string, sessionId: string): Promise<number> {
    const result = await ReplaySegmentModel.deleteMany({
      projectId: new mongoose.Types.ObjectId(projectId),
      sessionId,
    });
    return result.deletedCount;
  }

  /**
   * List replay sessions with stats for a project
   */
  async listReplaySessions(
    projectId: string,
    limit = 20,
    offset = 0
  ): Promise<{
    sessions: Array<{
      sessionId: string;
      segmentCount: number;
      totalEvents: number;
      startTimestamp: number;
      endTimestamp: number;
      createdAt: Date;
    }>;
    total: number;
  }> {
    const pid = new mongoose.Types.ObjectId(projectId);

    const [sessions, totalResult] = await Promise.all([
      ReplaySegmentModel.aggregate([
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
      ReplaySegmentModel.aggregate([
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

export const replayService = new ReplayService();
