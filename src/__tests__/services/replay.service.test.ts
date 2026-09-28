import mongoose from "mongoose";
import {
  replayService,
  MAX_SEGMENT_BYTES,
  MAX_EVENTS_PER_SEGMENT,
} from "../../services/replay.service";
import { ReplaySegmentModel } from "../../models/replayEvent.model";
import { PayloadTooLargeError, BadRequestError } from "../../errors";

const projectId = new mongoose.Types.ObjectId().toString();
const sessionId = "sess-1";

function makeEvents(count: number, payloadChars = 20) {
  return Array.from({ length: count }, (_, i) => ({
    type: 3,
    timestamp: 1_700_000_000_000 + i,
    data: { text: "x".repeat(payloadChars) },
  }));
}

describe("ReplayService.ingestSegment caps", () => {
  it("rejects a segment over the byte cap with a 413 and stores nothing", async () => {
    // ~1MB of JSON in a handful of events, under the event-count cap
    const events = makeEvents(10, 100 * 1024);
    expect(Buffer.byteLength(JSON.stringify(events))).toBeGreaterThan(MAX_SEGMENT_BYTES);

    const err = await replayService
      .ingestSegment(projectId, sessionId, events)
      .catch((e) => e);

    expect(err).toBeInstanceOf(PayloadTooLargeError);
    expect(err.statusCode).toBe(413);
    expect(err.message).toMatch(/max is 800KB/);
    expect(await ReplaySegmentModel.countDocuments()).toBe(0);
  });

  it("rejects a segment over the event-count cap", async () => {
    const events = makeEvents(MAX_EVENTS_PER_SEGMENT + 1, 1);

    const err = await replayService
      .ingestSegment(projectId, sessionId, events)
      .catch((e) => e);

    expect(err).toBeInstanceOf(PayloadTooLargeError);
    expect(err.message).toMatch(`max is ${MAX_EVENTS_PER_SEGMENT}`);
  });

  it("rejects an empty segment as a bad request", async () => {
    await expect(replayService.ingestSegment(projectId, sessionId, [])).rejects.toBeInstanceOf(
      BadRequestError
    );
  });
});

describe("ReplayService compression", () => {
  it("stores events gzipped and returns them intact", async () => {
    const events = makeEvents(500, 200);

    const segment = await replayService.ingestSegment(projectId, sessionId, events);
    expect(segment.eventCount).toBe(500);

    const stored = await ReplaySegmentModel.findById(segment._id).lean();
    expect(stored?.events).toBeUndefined();
    expect(stored?.rawBytes).toBe(Buffer.byteLength(JSON.stringify(events)));

    const [readBack] = await replayService.getSessionSegments(projectId, sessionId);
    expect(readBack.events).toEqual(events);
    expect(readBack).not.toHaveProperty("eventsGz");
  });

  it("still reads legacy uncompressed segments", async () => {
    const events = makeEvents(3);
    await ReplaySegmentModel.create({
      projectId: new mongoose.Types.ObjectId(projectId),
      sessionId,
      segmentIndex: 0,
      events,
      startTimestamp: 1,
      endTimestamp: 2,
      eventCount: 3,
    });

    const [readBack] = await replayService.getSessionSegments(projectId, sessionId);
    expect(readBack.events).toEqual(events);
  });
});

describe("ReplayService segment indexes", () => {
  it("gives two concurrent segments indexes 0 and 1", async () => {
    const results = await Promise.all([
      replayService.ingestSegment(projectId, sessionId, makeEvents(5)),
      replayService.ingestSegment(projectId, sessionId, makeEvents(5)),
    ]);

    expect(results.map((s) => s.segmentIndex).sort()).toEqual([0, 1]);
  });

  it("keeps indexes unique under a burst of concurrent uploads", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        replayService.ingestSegment(projectId, sessionId, makeEvents(2))
      )
    );

    const indexes = results.map((s) => s.segmentIndex).sort((a, b) => a - b);
    expect(indexes).toEqual(Array.from({ length: 20 }, (_, i) => i));
  });

  it("numbers each session independently", async () => {
    const [a, b] = await Promise.all([
      replayService.ingestSegment(projectId, "sess-a", makeEvents(1)),
      replayService.ingestSegment(projectId, "sess-b", makeEvents(1)),
    ]);

    expect(a.segmentIndex).toBe(0);
    expect(b.segmentIndex).toBe(0);
  });
});

describe("ReplayService client segment indexes", () => {
  it("stores segments at the index the SDK sends, whatever order they arrive in", async () => {
    await replayService.ingestSegment(projectId, sessionId, makeEvents(1), 2);
    await replayService.ingestSegment(projectId, sessionId, makeEvents(1), 0);
    await replayService.ingestSegment(projectId, sessionId, makeEvents(1), 1);

    const segments = await replayService.getSessionSegments(projectId, sessionId);
    expect(segments.map((s) => s.segmentIndex)).toEqual([0, 1, 2]);
  });

  it("replaces a retried segment instead of storing it twice", async () => {
    await replayService.ingestSegment(projectId, sessionId, makeEvents(3), 0);
    await replayService.ingestSegment(projectId, sessionId, makeEvents(3), 0);

    expect(await ReplaySegmentModel.countDocuments({ sessionId })).toBe(1);
  });
});
