// Mounting order mirrors server.ts: the /projects routers, saved searches
// included, come before the change routes that hold the CI deploy endpoint.

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

import express from "express";
import request from "supertest";
import savedSearchRoutes from "../../routes/savedSearch.routes";
import changeRoutes from "../../routes/change.routes";
import { DeploymentModel } from "../../models/deployment.model";
import { createTestProject, createTestUser } from "../factories";

const app = express();
app.use(express.json());
app.use("/api/v1/projects", savedSearchRoutes);
app.use("/api/v1", changeRoutes);

describe("POST /api/v1/projects/:projectId/deployments (CI, API key)", () => {
  it("records a deploy sent with the project's API key", async () => {
    const user = await createTestUser();
    const project = await createTestProject(String(user._id));

    const res = await request(app)
      .post(`/api/v1/projects/${project._id}/deployments`)
      .set("X-API-Key", project.apiKey)
      .send({ environment: "production", release: "v2.4.1", sha: "abc1234" });

    expect(res.status).toBe(201);
    expect(await DeploymentModel.countDocuments({ projectId: project._id })).toBe(1);
  });

  it("refuses a key that belongs to another project", async () => {
    const user = await createTestUser();
    const mine = await createTestProject(String(user._id));
    const theirs = await createTestProject(String(user._id));

    const res = await request(app)
      .post(`/api/v1/projects/${theirs._id}/deployments`)
      .set("X-API-Key", mine.apiKey)
      .send({ release: "v9.9.9" });

    expect(res.status).toBe(403);
    expect(await DeploymentModel.countDocuments()).toBe(0);
  });

  it("still requires a JWT for saved searches", async () => {
    const res = await request(app).get(
      "/api/v1/projects/507f1f77bcf86cd799439011/saved-searches"
    );
    expect(res.status).toBe(401);
  });
});
