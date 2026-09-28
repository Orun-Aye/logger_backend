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
import { ProjectModel } from "../../models/project.model";
import { createTestUser, createTestProject, generateAuthToken } from "../factories";

describe("Replay settings routes", () => {
  let projectId: string;
  let apiKey: string;
  let ownerToken: string;
  let viewerToken: string;
  let strangerToken: string;

  beforeEach(async () => {
    const owner = await createTestUser();
    ownerToken = generateAuthToken(owner._id as any);
    const project = await createTestProject(owner._id as any);
    projectId = project._id.toString();
    apiKey = project.apiKey;

    const viewer = await createTestUser();
    viewerToken = generateAuthToken(viewer._id as any);
    await ProjectModel.updateOne(
      { _id: project._id },
      { $push: { teamMembers: { user: viewer._id, role: "viewer" } } }
    );

    const stranger = await createTestUser();
    strangerToken = generateAuthToken(stranger._id as any);
  });

  const put = (token: string, body: object) =>
    request(app)
      .put(`/api/v1/projects/${projectId}/config/replay`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  it("defaults to off at 10%", async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/config/replay`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ enabled: false, sampleRate: 0.1 });
  });

  it("lets the owner turn replay on and set the sample rate", async () => {
    const res = await put(ownerToken, { enabled: true, sampleRate: 0.25 });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ enabled: true, sampleRate: 0.25 });
  });

  it("gives the SDK the setting, cacheable for 5 minutes", async () => {
    await put(ownerToken, { enabled: true, sampleRate: 0.5 });

    const res = await request(app).get("/api/v1/sdk-config").set("X-API-Key", apiKey);

    expect(res.status).toBe(200);
    expect(res.body.data.replay).toEqual({ enabled: true, sampleRate: 0.5 });
    expect(res.headers["cache-control"]).toBe("private, max-age=300");
  });

  it("lets a viewer read but not change the setting", async () => {
    const read = await request(app)
      .get(`/api/v1/projects/${projectId}/config/replay`)
      .set("Authorization", `Bearer ${viewerToken}`);
    const write = await put(viewerToken, { enabled: true });

    expect(read.status).toBe(200);
    expect(write.status).toBe(403);
  });

  it("refuses users outside the project, including the general config routes", async () => {
    expect((await put(strangerToken, { enabled: true })).status).toBe(403);

    const config = await request(app)
      .get(`/api/v1/projects/${projectId}/config`)
      .set("Authorization", `Bearer ${strangerToken}`);
    expect(config.status).toBe(403);
  });

  it("rejects an out-of-range sample rate", async () => {
    const res = await put(ownerToken, { sampleRate: 1.5 });
    expect(res.status).toBe(400);
  });
});
