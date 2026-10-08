// Root cause analysis has to give the AI the stack trace, page and release of
// the error, not just its message: with the message alone it can only guess
jest.mock("../../services/notification.service", () => ({
  NotificationService: {
    sendEmail: jest.fn().mockResolvedValue(undefined),
    sendInApp: jest.fn().mockResolvedValue(undefined),
  },
}));

import { AIInsightsService } from "../../services/ai-insights.service";
import { AIService } from "../../utils/ai/ai.service";
import { createTestUser, createTestProject, createTestLog } from "../factories";

const STACK = [
  "TypeError: Cannot read properties of undefined (reading 'email')",
  "    at renderCheckoutSummary (https://shop.example.com/js/checkout.js:25:25)",
  "    at initCheckout (https://shop.example.com/js/checkout.js:12:3)",
].join("\n");

describe("AIInsightsService.getRootCause", () => {
  const analyze = jest.spyOn(AIService, "analyzeErrorGroup");

  afterEach(() => analyze.mockReset());
  afterAll(() => analyze.mockRestore());

  async function seedErrors(count: number) {
    const user = await createTestUser();
    const project = await createTestProject(String(user._id));
    const projectId = String(project._id);
    const logs = [];
    for (let i = 0; i < count; i++) {
      logs.push(
        await createTestLog(projectId, {
          level: "error",
          message: "Cannot read properties of undefined (reading 'email')",
          service: "demo-shop",
          environment: "production",
          release: "v2.4.1",
          url: "https://shop.example.com/checkout",
          error: {
            name: "TypeError",
            message: "Cannot read properties of undefined (reading 'email')",
            stack: STACK,
          },
        })
      );
    }
    return { projectId, newest: logs[logs.length - 1] };
  }

  it("sends the stack trace, page, release and one line per distinct message", async () => {
    analyze.mockResolvedValue("checkout.js reads .email from an undefined profile.");
    const { projectId, newest } = await seedErrors(3);

    const result = await AIInsightsService.getRootCause(projectId, String(newest._id));

    expect(result).toMatchObject({ source: "ai" });
    expect(analyze).toHaveBeenCalledTimes(1);
    const [messages, context] = analyze.mock.calls[0];
    expect(messages).toEqual([
      "[demo-shop] TypeError: Cannot read properties of undefined (reading 'email') (3 times)",
    ]);
    expect(context).toMatchObject({
      projectId,
      service: "demo-shop",
      environment: "production",
      release: "v2.4.1",
      url: "https://shop.example.com/checkout",
      occurrences: 3,
    });
    expect(context.stack).toContain("checkout.js:25:25");
  });

  it("falls back to the heuristic when the AI is unavailable", async () => {
    analyze.mockResolvedValue(null);
    const { projectId, newest } = await seedErrors(1);

    const result = await AIInsightsService.getRootCause(projectId, String(newest._id));

    expect(result.source).toBe("heuristic");
    expect(result.analysis).toContain("Found 1 similar errors");
  });
});
