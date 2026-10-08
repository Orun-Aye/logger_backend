// Mock ESM modules that Jest cannot parse (otplib uses @scure/base ESM export)
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
jest.mock("../../services/notification.service", () => ({
  NotificationService: {
    sendEmail: jest.fn().mockResolvedValue(undefined),
    sendInApp: jest.fn().mockResolvedValue(undefined),
  },
}));

import { GithubWebhookService } from "../../services/github-webhook.service";
import { DeploymentService } from "../../services/deployment.service";
import { DeploymentModel } from "../../models/deployment.model";
import { CommitModel } from "../../models/commit.model";
import { createTestProject, createTestUser } from "../factories";

const SHA = "a".repeat(40);

const deploymentEvent = (id: number, ref: string) => ({
  repository: { full_name: "acme/shop" },
  deployment: {
    id,
    sha: SHA,
    ref,
    environment: "Production",
    created_at: new Date().toISOString(),
    creator: { login: "vercel[bot]" },
  },
});

describe("deployments follow the linked branch", () => {
  let projectId: string;

  beforeEach(async () => {
    const user = await createTestUser();
    const project = await createTestProject(String(user._id), {
      integrationSettings: {
        githubRepo: { owner: "acme", repo: "shop", branch: "demo", linkedBy: user._id, linkedAt: new Date() },
      },
    });
    projectId = String(project._id);
  });

  it("ignores a deploy from another branch", async () => {
    await GithubWebhookService.processEvent("deployment", deploymentEvent(1, "main"));
    expect(await DeploymentModel.countDocuments({ projectId })).toBe(0);
  });

  it("keeps a deploy from the linked branch", async () => {
    await GithubWebhookService.processEvent("deployment", deploymentEvent(2, "demo"));
    expect(await DeploymentModel.countDocuments({ projectId })).toBe(1);
  });

  describe("belongsToTrackedBranch", () => {
    it("matches branch refs, with or without refs/heads/", async () => {
      expect(await DeploymentService.belongsToTrackedBranch(projectId, "demo", { ref: "demo" })).toBe(true);
      expect(await DeploymentService.belongsToTrackedBranch(projectId, "demo", { ref: "refs/heads/demo" })).toBe(true);
      expect(await DeploymentService.belongsToTrackedBranch(projectId, "demo", { ref: "main" })).toBe(false);
    });

    it("accepts a SHA ref only when it is a commit from the tracked branch", async () => {
      expect(await DeploymentService.belongsToTrackedBranch(projectId, "demo", { ref: SHA })).toBe(false);

      await CommitModel.create({
        projectId,
        sha: SHA,
        message: "feat: something",
        authorName: "Dev",
        committedAt: new Date(),
        branch: "demo",
        aiSummaryStatus: "skipped",
        source: "webhook",
      });
      expect(await DeploymentService.belongsToTrackedBranch(projectId, "demo", { ref: SHA })).toBe(true);
    });

    it("keeps deploys without a ref", async () => {
      expect(await DeploymentService.belongsToTrackedBranch(projectId, "demo", {})).toBe(true);
    });
  });
});
