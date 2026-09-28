import mongoose from 'mongoose';
import { promisify } from 'util';
import { gzip, gunzip } from 'zlib';
import {
  ReplaySegmentModel,
  ReplaySessionCounterModel,
  IReplaySegment,
} from '../models/replayEvent.model';
import { BadRequestError, PayloadTooLargeError } from '../errors';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

/**
 * Caps keep a segment far below MongoDB's 16MB document limit. rrweb
 * snapshots compress roughly 5-10x, so 800KB raw stores as ~100-150KB.
 */
export const MAX_SEGMENT_BYTES = 800 * 1024;
export const MAX_EVENTS_PER_SEGMENT = 5000;

export interface ReplaySegmentDTO {
  _id: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  sessionId: string;
  segmentIndex: number;
  events: any[];
  startTimestamp: number;
  endTimestamp: number;
  eventCount: number;
  createdAt: Date;
}

type StoredEvents = { events?: any[]; eventsGz?: unknown; rawBytes?: number };

class ReplayService {
  /**
   * Ingest a batch of replay events as a numbered segment
   */
  async ingestSegment(
    projectId: string,
    sessionId: string,
    events: any[],
    clientSegmentIndex?: number
  ): Promise<IReplaySegment> {
    if (!Array.isArray(events) || events.length === 0) {
      throw new BadRequestError('No events provided');
    }

    if (events.length > MAX_EVENTS_PER_SEGMENT) {
      throw new PayloadTooLargeError(
        `Replay segment has ${events.length} events; max is ${MAX_EVENTS_PER_SEGMENT}. Split it into smaller segments.`,
        { eventCount: events.length, maxEvents: MAX_EVENTS_PER_SEGMENT }
      );
    }

    const raw = Buffer.from(JSON.stringify(events), 'utf8');
    if (raw.length > MAX_SEGMENT_BYTES) {
      throw new PayloadTooLargeError(
        `Replay segment is ${Math.round(raw.length / 1024)}KB; max is ${MAX_SEGMENT_BYTES / 1024}KB. Split it into smaller segments.`,
        { bytes: raw.length, maxBytes: MAX_SEGMENT_BYTES }
      );
    }

    // The SDK numbers its own segments, which keeps them in recording order
    // even when they arrive out of order (an unload flush can overtake an
    // earlier upload). Clients that send no index get the next one in
    // arrival order from an atomic counter.
    const segmentIndex =
      clientSegmentIndex ?? (await this.claimSegmentIndex(projectId, sessionId));

    // Extract timestamps from events
    const timestamps = events
      .map((e: any) => e.timestamp)
      .filter((t: any) => typeof t === 'number');
    const startTimestamp = timestamps.length > 0 ? Math.min(...timestamps) : Date.now();
    const endTimestamp = timestamps.length > 0 ? Math.max(...timestamps) : Date.now();

    // Upsert on the index so a retried upload replaces itself rather than
    // storing the same segment twice
    const segment = await ReplaySegmentModel.findOneAndUpdate(
      { projectId: new mongoose.Types.ObjectId(projectId), sessionId, segmentIndex },
      {
        $set: {
          eventsGz: await gzipAsync(raw),
          rawBytes: raw.length,
          startTimestamp,
          endTimestamp,
          eventCount: events.length,
        },
      },
      { upsert: true, new: true }
    );

    return segment!;
  }

  /**
   * Atomically claim the next segment index for a session (0, 1, 2, ...).
   * Two concurrent upserts for a brand-new session can both try to insert
   * the counter; the loser gets a duplicate-key error and retries as an update.
   */
  private async claimSegmentIndex(projectId: string, sessionId: string): Promise<number> {
    const filter = { projectId: new mongoose.Types.ObjectId(projectId), sessionId };
    for (let attempt = 0; ; attempt++) {
      try {
        const counter = await ReplaySessionCounterModel.findOneAndUpdate(
          filter,
          { $inc: { seq: 1 } },
          { upsert: true, new: true }
        ).lean();
        return counter!.seq - 1;
      } catch (error: any) {
        if (error?.code !== 11000 || attempt >= 2) throw error;
      }
    }
  }

  /**
   * Get all segments for a session, ordered by segment index
   */
  async getSessionSegments(
    projectId: string,
    sessionId: string
  ): Promise<ReplaySegmentDTO[]> {
    const segments = await ReplaySegmentModel.find(
      { projectId: new mongoose.Types.ObjectId(projectId), sessionId }
    )
      .sort({ segmentIndex: 1 })
      .lean<Array<Omit<ReplaySegmentDTO, 'events'> & StoredEvents>>();

    return Promise.all(
      segments.map(async ({ eventsGz, rawBytes, events, ...rest }) => ({
        ...rest,
        // Legacy segments predate compression and still hold plain events
        events: eventsGz
          ? JSON.parse((await gunzipAsync(toBuffer(eventsGz))).toString('utf8'))
          : events ?? [],
      }))
    );
  }

  /**
   * Which of the given sessions have a playable replay. Playable means the
   * first segment exists: it carries the page snapshot everything else
   * replays against. Reads indexes only, never event payloads.
   */
  async findSessionsWithReplay(projectId: string, sessionIds: string[]): Promise<string[]> {
    if (sessionIds.length === 0) return [];
    return ReplaySegmentModel.distinct('sessionId', {
      projectId: new mongoose.Types.ObjectId(projectId),
      sessionId: { $in: sessionIds },
      segmentIndex: 0,
    });
  }

  /**
   * Delete all replay data for a session
   */
  async deleteSession(projectId: string, sessionId: string): Promise<number> {
    const filter = { projectId: new mongoose.Types.ObjectId(projectId), sessionId };
    const [result] = await Promise.all([
      ReplaySegmentModel.deleteMany(filter),
      ReplaySessionCounterModel.deleteOne(filter),
    ]);
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

/** lean() returns BSON Binary for Buffer fields, not a Node Buffer */
function toBuffer(value: any): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value?.buffer) return Buffer.from(value.buffer);
  return Buffer.from(value);
}

export const replayService = new ReplayService();
