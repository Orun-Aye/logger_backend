jest.mock("otplib", () => ({
  generateSecret: jest.fn().mockReturnValue("MOCKSECRET"),
  generateURI: jest.fn().mockReturnValue("otpauth://totp/mock"),
  verify: jest.fn().mockReturnValue(true),
}));
jest.mock("qrcode", () => ({
  toDataURL: jest.fn().mockResolvedValue("data:image/png;base64,mock"),
}));
jest.mock("../../server", () => ({
  globalServices: { dashboardWebSocketService: null },
}));

import request from "supertest";
import app from "../app";
import {
  createTestUser,
  createTestProject,
  createTestLog,
  generateAuthToken,
} from "../factories";

describe("Insights Routes", () => {
  let projectId: string;
  let authToken: string;

  beforeEach(async () => {
    const user = await createTestUser();
    authToken = generateAuthToken(user._id as any);
    projectId = (await createTestProject(user._id as any))._id.toString();
    await createTestLog(projectId, { level: "info" });
    await createTestLog(projectId, { level: "error", message: "Boom" });
  });

  // Regression: routes were declared as /insights/:projectId under the
  // /api/v1/insights mount, so the dashboard's calls all returned 404
  it("should serve project insights at /api/v1/insights/:projectId", async () => {
    const res = await request(app)
      .get(`/api/v1/insights/${projectId}?range=24h`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.summary.totalLogs).toBe(2);
    expect(res.body.data.summary.errorRate).toBe(50);
    expect(res.body.data.timeRange.range).toBe("24h");
    expect(res.body.data.errorAnalysis.frequentErrorMessages[0]).toMatchObject({
      message: "Boom",
      count: 1,
    });
  });

  it("should compare log volume with the previous period", async () => {
    await createTestLog(projectId, {
      timestamp: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
    });

    const res = await request(app)
      .get(`/api/v1/insights/${projectId}?range=24h`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.body.data.volumeTrends).toEqual({
      currentPeriod: 2,
      previousPeriod: 1,
      percentageChange: 100,
    });
  });

  it("should serve suggestions at /api/v1/insights/:projectId/suggestions", async () => {
    const res = await request(app)
      .get(`/api/v1/insights/${projectId}/suggestions`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("should no longer answer on the doubled /insights/insights path", async () => {
    const res = await request(app)
      .get(`/api/v1/insights/insights/${projectId}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).not.toBe(200);
  });
});
