// Mock ESM modules that Jest cannot parse (otplib uses @scure/base ESM export)
jest.mock("otplib", () => ({
  generateSecret: jest.fn().mockReturnValue("MOCKSECRET"),
  generateURI: jest.fn().mockReturnValue("otpauth://totp/mock"),
  verify: jest.fn().mockReturnValue(true),
}));
jest.mock("qrcode", () => ({
  toDataURL: jest.fn().mockResolvedValue("data:image/png;base64,mock"),
}));

// Mock server module (WebSocket service)
jest.mock("../../server", () => ({
  globalServices: {
    dashboardWebSocketService: null,
  },
}));

jest.mock("../../services/notification.service", () => ({
  NotificationService: {
    sendEmail: jest.fn().mockResolvedValue(undefined),
    sendSlack: jest.fn().mockResolvedValue(undefined),
    sendWebhook: jest.fn().mockResolvedValue(undefined),
    sendInApp: jest.fn().mockResolvedValue(undefined),
  },
}));

// No real GitHub: every repo has a token, every commit a small diff
jest.mock("../../services/integrations/github-app.service", () => ({
  GithubAppService: {
    getTokenForRepo: jest.fn().mockResolvedValue({ token: "test-token" }),
  },
}));
jest.mock("../../services/integrations/github-client", () => ({
  ...jest.requireActual("../../services/integrations/github-client"),
  getCommitDetail: jest.fn(async (_token: string, _o: string, _r: string, sha: string) => ({
    sha,
    commit: { message: `Commit ${sha}` },
    files: [],
    stats: { additions: 1, deletions: 0 },
  })),
}));

import request from "supertest";
import app from "../app";
import { AiBudgetService } from "../../services/aiBudget.service";
import { ChangeService } from "../../services/change.service";
import { AIService } from "../../utils/ai/ai.service";
import { getCommitDetail } from "../../services/integrations/github-client";
import { CommitModel } from "../../models/commit.model";
import { config } from "../../config";
import { createTestUser, createTestProject, generateAuthToken } from "../factories";

const LIMIT = 3;

// The AI answers every commit it is given
const summarizeSpy = jest
  .spyOn(AIService, "summarizeCommitBatch")
  .mockImplementation(async (items) =>
    items.map((i) => ({
      sha: i.sha,
      summary: `Summary of ${i.sha}`,
      technicalSummary: `Technical summary of ${i.sha}`,
    }))
  );

describe("Monthly AI summary cap", () => {
  const originalLimit = config.anthropic.monthlySummaryLimit;
  let projectId: string;
  let token: string;

  beforeAll(() => {
    (config.anthropic as any).monthlySummaryLimit = LIMIT;
  });

  afterAll(() => {
    (config.anthropic as any).monthlySummaryLimit = originalLimit;
  });

  beforeEach(async () => {
    summarizeSpy.mockClear();
    (getCommitDetail as jest.Mock).mockClear();
    const user = await createTestUser();
    const project = await createTestProject(user._id as any);
    projectId = project._id.toString();
    token = generateAuthToken(user._id as any);
  });

  /** Store pending commits the way the push webhook does, then summarize them. */
  const push = async (shas: string[]) => {
    await CommitModel.insertMany(
      shas.map((sha, i) => ({
        projectId,
        sha,
        message: `Commit ${sha}`,
        authorName: "dev",
        committedAt: new Date(Date.now() - i * 1000),
        aiSummaryStatus: "pending",
        source: "webhook",
      }))
    );
    await ChangeService.summarizeCommits(projectId, "acme", "app", shas);
  };

  const statusOf = async (sha: string) =>
    (await CommitModel.findOne({ projectId, sha }).lean())!.aiSummaryStatus;

  describe("AiBudgetService", () => {
    it("grants up to the cap, then nothing", async () => {
      expect((await AiBudgetService.reserveSummaries(projectId, 2)).granted).toBe(2);
      expect((await AiBudgetService.reserveSummaries(projectId, 5)).granted).toBe(1);
      expect((await AiBudgetService.reserveSummaries(projectId, 1)).granted).toBe(0);
      expect((await AiBudgetService.getUsage(projectId)).used).toBe(LIMIT);
    });

    it("never exceeds the cap under concurrent reservations", async () => {
      const results = await Promise.all(
        [1, 2, 3, 4, 5, 6].map(() => AiBudgetService.reserveSummaries(projectId, 1))
      );
      const granted = results.reduce((sum, r) => sum + r.granted, 0);
      expect(granted).toBe(LIMIT);
      expect((await AiBudgetService.getUsage(projectId)).used).toBe(LIMIT);
    });

    it("resets each calendar month", async () => {
      const september = new Date(Date.UTC(2026, 8, 30));
      const october = new Date(Date.UTC(2026, 9, 1));
      await AiBudgetService.reserveSummaries(projectId, LIMIT, september);
      expect((await AiBudgetService.reserveSummaries(projectId, 1, september)).granted).toBe(0);
      expect((await AiBudgetService.reserveSummaries(projectId, 1, october)).granted).toBe(1);
    });

    it("refunds to the month the slots came from", async () => {
      const september = new Date(Date.UTC(2026, 8, 30));
      const reservation = await AiBudgetService.reserveSummaries(projectId, 2, september);
      await AiBudgetService.releaseSummaries(projectId, reservation, 2);
      expect((await AiBudgetService.getUsage(projectId, september)).used).toBe(0);
    });
  });

  describe("ChangeService.summarizeCommits", () => {
    it("summarizes up to the cap and marks the rest budget_exceeded", async () => {
      await push(["a1", "a2", "a3", "a4", "a5"]);

      expect(summarizeSpy).toHaveBeenCalledTimes(1);
      expect(summarizeSpy.mock.calls[0][0].map((i) => i.sha)).toEqual(["a1", "a2", "a3"]);
      expect(await statusOf("a3")).toBe("complete");
      expect(await statusOf("a4")).toBe("budget_exceeded");
      expect(await statusOf("a5")).toBe("budget_exceeded");
      expect((await AiBudgetService.getUsage(projectId)).used).toBe(LIMIT);
    });

    it("makes no AI or GitHub calls once the cap is hit", async () => {
      await push(["b1", "b2", "b3"]);
      summarizeSpy.mockClear();
      (getCommitDetail as jest.Mock).mockClear();

      await push(["b4"]);

      expect(summarizeSpy).not.toHaveBeenCalled();
      expect(getCommitDetail).not.toHaveBeenCalled();
      expect(await statusOf("b4")).toBe("budget_exceeded");
    });

    it("refunds the budget when the AI call fails", async () => {
      summarizeSpy.mockResolvedValueOnce(null);
      await push(["c1", "c2"]);

      expect(await statusOf("c1")).toBe("failed");
      expect((await AiBudgetService.getUsage(projectId)).used).toBe(0);
    });

    it("refunds commits the model skipped and ignores invented shas", async () => {
      summarizeSpy.mockResolvedValueOnce([
        { sha: "d1", summary: "s", technicalSummary: "t" },
        { sha: "not-in-batch", summary: "s", technicalSummary: "t" },
      ]);
      await push(["d1", "d2"]);

      expect(await statusOf("d1")).toBe("complete");
      expect(await statusOf("d2")).toBe("failed");
      expect((await AiBudgetService.getUsage(projectId)).used).toBe(1);
    });
  });

  describe("GET /api/v1/projects/:projectId/changes", () => {
    it("still renders the feed after the cap is hit", async () => {
      await push(["e1", "e2", "e3", "e4", "e5"]);

      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/changes`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data).toHaveLength(5);

      const overBudget = res.body.data.find((item: any) => item.sha === "e5");
      expect(overBudget.aiSummaryStatus).toBe("budget_exceeded");
      expect(overBudget.message).toBe("Commit e5");
      expect(overBudget.aiSummary).toBeUndefined();

      const summarized = res.body.data.find((item: any) => item.sha === "e1");
      expect(summarized.aiSummary).toBe("Summary of e1");

      expect(res.body.meta.aiSummaryUsage).toMatchObject({ used: LIMIT, limit: LIMIT });
    });
  });
});
