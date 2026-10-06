import { Types } from "mongoose";
import { AnalyticsService } from "../../services/analytics.service";
import { ReplaySegmentModel } from "../../models/replayEvent.model";
import { createTestUser, createTestProject, createTestLog } from "../factories";

const CHROME_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36";

describe("AnalyticsService sessions", () => {
  let projectId: string;
  const base = Date.now() - 60 * 60 * 1000;
  const at = (offsetMs: number) => new Date(base + offsetMs).toISOString();

  beforeEach(async () => {
    const user = await createTestUser();
    const project = await createTestProject(user._id as any);
    projectId = project._id.toString();

    // Recorded session: two logs 1ms apart, replay running 49s
    await createTestLog(projectId, {
      sessionId: "recorded",
      timestamp: at(0),
      eventType: "pageview",
      userAgent: CHROME_WINDOWS,
    });
    await createTestLog(projectId, { sessionId: "recorded", timestamp: at(1) });
    await ReplaySegmentModel.create({
      projectId: new Types.ObjectId(projectId),
      sessionId: "recorded",
      segmentIndex: 0,
      startTimestamp: base - 500,
      endTimestamp: base + 49_000,
      eventCount: 10,
    });

    // Unrecorded session: logs 4s apart
    await createTestLog(projectId, { sessionId: "plain", timestamp: at(10_000) });
    await createTestLog(projectId, { sessionId: "plain", timestamp: at(14_000) });
  });

  it("should report duration in ms, widened to the replay span", async () => {
    const { sessions } = await AnalyticsService.getSessions(projectId, {
      timeRange: "24h",
      page: 1,
      limit: 20,
    });
    const byId = Object.fromEntries(sessions.map((s: any) => [s._id, s]));

    expect(byId.recorded.duration).toBe(49_500);
    expect(byId.recorded.hasReplay).toBe(true);
    expect(byId.plain.duration).toBe(4_000);
    expect(byId.plain.hasReplay).toBe(false);
  });

  it("should derive device and browser from the User-Agent", async () => {
    const { sessions } = await AnalyticsService.getSessions(projectId, {
      timeRange: "24h",
      page: 1,
      limit: 20,
    });
    const recorded = sessions.find((s: any) => s._id === "recorded") as any;

    expect(recorded.device).toBe("desktop");
    expect(recorded.browser).toBe("Chrome");
    expect(recorded.os).toBe("Windows");
  });

  it("should use the same durations for the session detail and average", async () => {
    const detail = await AnalyticsService.getSessionDetails(projectId, "recorded");
    expect(detail!.duration).toBe(49_500);
    expect(detail!.device).toBe("desktop");

    const stats = await AnalyticsService.getSessionStats(projectId, { timeRange: "24h" });
    expect(stats.totalSessions).toBe(2);
    expect(stats.avgDuration).toBe((49_500 + 4_000) / 2);
  });
});
