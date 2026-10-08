import { Types } from "mongoose";
import { DeploymentService } from "../../services/deployment.service";
import {
  DeploymentModel,
  repairDeploymentIndexes,
} from "../../models/deployment.model";
import { LogModel } from "../../models/log.model";

const deploymentPayload = (id: number, sha = `sha${id}`) => ({
  deployment: {
    id,
    sha,
    ref: "main",
    environment: "Production",
    description: null,
    created_at: new Date().toISOString(),
    creator: { login: "vercel[bot]" },
  },
});

describe("DeploymentService", () => {
  const projectId = new Types.ObjectId().toString();

  describe("handleDeploymentEvent", () => {
    // Regression: a sparse unique index on (projectId, githubReleaseId) let
    // only the first deploy per project be stored
    it("should store every deploy, not just the first", async () => {
      await DeploymentService.handleDeploymentEvent(projectId, deploymentPayload(1));
      await DeploymentService.handleDeploymentEvent(projectId, deploymentPayload(2));
      await DeploymentService.handleDeploymentEvent(projectId, deploymentPayload(3));

      expect(await DeploymentModel.countDocuments({ projectId })).toBe(3);
    });

    it("should store a deploy alongside releases", async () => {
      const release = (id: number) => ({
        id,
        tag_name: `v${id}`,
        name: null,
        html_url: `https://github.com/o/r/releases/${id}`,
        published_at: new Date().toISOString(),
      });
      await DeploymentService.upsertGithubReleases(projectId, [release(10), release(11)]);
      await DeploymentService.handleDeploymentEvent(projectId, deploymentPayload(1));

      expect(await DeploymentModel.countDocuments({ projectId, kind: "release" })).toBe(2);
      expect(await DeploymentModel.countDocuments({ projectId, kind: "deployment" })).toBe(1);
    });

    it("should update, not duplicate, a redelivered deploy", async () => {
      await DeploymentService.handleDeploymentEvent(projectId, deploymentPayload(7));
      await DeploymentService.handleDeploymentEvent(projectId, deploymentPayload(7));

      expect(await DeploymentModel.countDocuments({ projectId })).toBe(1);
    });
  });

  describe("upsertGithubDeployment", () => {
    it("should store the deploy with its latest status", async () => {
      const { deployment } = deploymentPayload(42);
      await DeploymentService.upsertGithubDeployment(projectId, deployment, {
        state: "success",
        environment_url: "https://example.vercel.app",
        created_at: new Date().toISOString(),
      });

      const stored = await DeploymentModel.findOne({ projectId, githubDeploymentId: 42 }).lean();
      expect(stored!.status).toBe("success");
      expect(stored!.url).toBe("https://example.vercel.app");
      expect(stored!.finishedAt).toBeInstanceOf(Date);
    });
  });

  describe("repairDeploymentIndexes", () => {
    it("should drop the legacy sparse indexes and keep deploys insertable", async () => {
      await DeploymentModel.collection.dropIndex("projectId_githubReleaseId_unique");
      await DeploymentModel.collection.createIndex(
        { projectId: 1, githubReleaseId: 1 },
        { unique: true, sparse: true, name: "projectId_1_githubReleaseId_1" }
      );

      const dropped = await repairDeploymentIndexes();

      expect(dropped).toEqual(["projectId_1_githubReleaseId_1"]);
      const names = (await DeploymentModel.collection.indexes()).map((i) => i.name);
      expect(names).toContain("projectId_githubReleaseId_unique");
      expect(names).not.toContain("projectId_1_githubReleaseId_1");

      await DeploymentService.handleDeploymentEvent(projectId, deploymentPayload(1));
      await DeploymentService.handleDeploymentEvent(projectId, deploymentPayload(2));
      expect(await DeploymentModel.countDocuments({ projectId })).toBe(2);
    });

    it("should do nothing once repaired", async () => {
      expect(await repairDeploymentIndexes()).toEqual([]);
    });
  });

  describe("computeImpact", () => {
    const HOUR = 60 * 60 * 1000;
    const startedAt = new Date(Date.now() - 2 * HOUR);

    // Raw inserts so createdAt can sit before or after the deploy
    const logs = (count: number, level: string, offsetMs: number) =>
      LogModel.collection.insertMany(
        Array.from({ length: count }, (_, i) => ({
          projectId,
          level,
          message: `${level} ${i}`,
          timestamp: new Date(startedAt.getTime() + offsetMs).toISOString(),
          createdAt: new Date(startedAt.getTime() + offsetMs + i * 1000),
        }))
      );

    const deploy = () =>
      DeploymentModel.create({
        projectId,
        kind: "deployment",
        provider: "api",
        environment: "production",
        status: "success",
        startedAt,
      });

    it("says not enough traffic when nothing was seen before the deploy", async () => {
      // A brand-new project: errors right after its first deploy say nothing
      // about whether the deploy made things worse
      await logs(3, "info", 10 * 60 * 1000);
      await logs(6, "error", 20 * 60 * 1000);
      const dep = await deploy();

      await DeploymentService.computeImpact(dep);

      expect(dep.impact?.verdict).toBe("unknown");
    });

    it("still flags a clear error burst after a quiet, low-traffic hour", async () => {
      await logs(4, "info", -30 * 60 * 1000);
      await logs(6, "error", 20 * 60 * 1000);
      const dep = await deploy();

      await DeploymentService.computeImpact(dep);

      expect(dep.impact?.verdict).toBe("degraded");
    });

    it("compares error rates when both hours have enough traffic", async () => {
      await logs(40, "info", -30 * 60 * 1000);
      await logs(10, "error", -20 * 60 * 1000);
      await logs(50, "info", 20 * 60 * 1000);
      const dep = await deploy();

      await DeploymentService.computeImpact(dep);

      expect(dep.impact?.verdict).toBe("improved");
    });
  });
});
