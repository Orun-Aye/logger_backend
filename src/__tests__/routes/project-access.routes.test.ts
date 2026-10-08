// Project-scoped JWT routes must check that the caller belongs to the project.
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
// Linking starts a GitHub backfill; keep it off the network
jest.mock("../../services/change.service", () => {
  const actual = jest.requireActual("../../services/change.service");
  actual.ChangeService.backfillProject = jest.fn().mockResolvedValue(undefined);
  return actual;
});

import express from "express";
import request from "supertest";
import changeRoutes from "../../routes/change.routes";
import githubIntegrationRoutes from "../../routes/githubIntegration.routes";
import { ProjectModel } from "../../models/project.model";
import { createTestProject, createTestUser, generateAuthToken } from "../factories";

const app = express();
app.use(express.json());
app.use("/api/v1", githubIntegrationRoutes);
app.use("/api/v1", changeRoutes);

const as = (userId: string) => ({ Authorization: `Bearer ${generateAuthToken(userId)}` });

describe("project-scoped routes check membership", () => {
  let ownerId: string;
  let viewerId: string;
  let strangerId: string;
  let projectId: string;

  beforeEach(async () => {
    ownerId = String((await createTestUser())._id);
    viewerId = String((await createTestUser())._id);
    strangerId = String((await createTestUser())._id);
    const project = await createTestProject(ownerId as any, {
      teamMembers: [
        { user: ownerId, role: "admin" },
        { user: viewerId, role: "viewer" },
      ],
    });
    projectId = String(project._id);
  });

  it.each([
    ["get", "changes"],
    ["get", "deployments"],
    ["get", "error-groups"],
    ["get", "recent-commits"],
  ])("refuses a stranger: %s /projects/:id/%s", async (method, path) => {
    const res = await (request(app) as any)[method](`/api/v1/projects/${projectId}/${path}`).set(as(strangerId));
    expect(res.status).toBe(403);
  });

  it("refuses a stranger linking a repo to someone else's project", async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/github-link`)
      .set(as(strangerId))
      .send({ owner: "attacker", repo: "evil" });

    expect(res.status).toBe(403);
    const project = await ProjectModel.findById(projectId).lean();
    expect(project?.integrationSettings?.githubRepo).toBeUndefined();
  });

  it("refuses a stranger changing an error group's status", async () => {
    const res = await request(app)
      .patch(`/api/v1/projects/${projectId}/error-groups/507f1f77bcf86cd799439011`)
      .set(as(strangerId))
      .send({ status: "resolved" });
    expect(res.status).toBe(403);
  });

  it("lets a viewer read but not link a repo", async () => {
    const read = await request(app).get(`/api/v1/projects/${projectId}/changes`).set(as(viewerId));
    expect(read.status).toBe(200);

    const link = await request(app)
      .post(`/api/v1/projects/${projectId}/github-link`)
      .set(as(viewerId))
      .send({ owner: "o", repo: "r" });
    expect(link.status).toBe(403);
  });

  it("lets the owner link a repo", async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/github-link`)
      .set(as(ownerId))
      .send({ owner: "o", repo: "r", branch: "main" });

    expect(res.status).toBe(200);
    const project = await ProjectModel.findById(projectId).lean();
    expect(project?.integrationSettings?.githubRepo).toEqual(
      expect.objectContaining({ owner: "o", repo: "r" })
    );
  });

  it("answers 404, not 500, for a malformed project id", async () => {
    const res = await request(app).get("/api/v1/projects/not-an-id/changes").set(as(ownerId));
    expect(res.status).toBe(404);
  });
});
