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
import { ReplaySegmentModel } from "../../models/replayEvent.model";
import { createTestUser, createTestProject, generateAuthToken } from "../factories";

const events = [{ type: 2, timestamp: 1, data: {} }];

describe("Replay Routes", () => {
  let projectId: string;
  let apiKey: string;
  let ownerToken: string;
  let otherApiKey: string;
  let strangerToken: string;

  beforeEach(async () => {
    const owner = await createTestUser();
    ownerToken = generateAuthToken(owner._id as any);
    const project = await createTestProject(owner._id as any);
    projectId = project._id.toString();
    apiKey = project.apiKey;

    const stranger = await createTestUser();
    strangerToken = generateAuthToken(stranger._id as any);
    const otherProject = await createTestProject(stranger._id as any);
    otherApiKey = otherProject.apiKey;
  });

  describe("POST /:projectId/replay", () => {
    it("stores a segment at the SDK's index", async () => {
      const res = await request(app)
        .post(`/api/v1/${projectId}/replay`)
        .set("X-API-Key", apiKey)
        .send({ sessionId: "s1", segmentIndex: 4, events });

      expect(res.status).toBe(201);
      expect(res.body.data.segmentIndex).toBe(4);
    });

    it("rejects an API key from a different project", async () => {
      const res = await request(app)
        .post(`/api/v1/${projectId}/replay`)
        .set("X-API-Key", otherApiKey)
        .send({ sessionId: "s1", events });

      expect(res.status).toBe(403);
      expect(await ReplaySegmentModel.countDocuments()).toBe(0);
    });

    it("rejects a malformed segmentIndex", async () => {
      const res = await request(app)
        .post(`/api/v1/${projectId}/replay`)
        .set("X-API-Key", apiKey)
        .send({ sessionId: "s1", segmentIndex: -1, events });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /:projectId/replay/:sessionId", () => {
    beforeEach(async () => {
      await request(app)
        .post(`/api/v1/${projectId}/replay`)
        .set("X-API-Key", apiKey)
        .send({ sessionId: "s1", segmentIndex: 0, events });
    });

    it("returns segments to the project owner", async () => {
      const res = await request(app)
        .get(`/api/v1/${projectId}/replay/s1`)
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data[0].events).toEqual(events);
    });

    it("refuses a signed-in user who is not on the project", async () => {
      const res = await request(app)
        .get(`/api/v1/${projectId}/replay/s1`)
        .set("Authorization", `Bearer ${strangerToken}`);

      expect(res.status).toBe(403);
    });

    it("refuses to list or delete another project's sessions", async () => {
      const list = await request(app)
        .get(`/api/v1/${projectId}/replay/sessions`)
        .set("Authorization", `Bearer ${strangerToken}`);
      const del = await request(app)
        .delete(`/api/v1/${projectId}/replay/sessions/s1`)
        .set("Authorization", `Bearer ${strangerToken}`);

      expect(list.status).toBe(403);
      expect(del.status).toBe(403);
    });
  });

  describe("GET /:projectId/replay/available", () => {
    const ingest = (sessionId: string, segmentIndex: number) =>
      request(app)
        .post(`/api/v1/${projectId}/replay`)
        .set("X-API-Key", apiKey)
        .send({ sessionId, segmentIndex, events });

    it("lists only the sessions whose replay can be played", async () => {
      await ingest("with-replay", 0);
      await ingest("with-replay", 1);
      // Only a later segment arrived: no page snapshot to play against
      await ingest("missing-start", 3);

      const res = await request(app)
        .get(`/api/v1/${projectId}/replay/available`)
        .query({ sessionIds: "with-replay,missing-start,never-recorded" })
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.sessionIds).toEqual(["with-replay"]);
    });

    it("is not mistaken for a session ID", async () => {
      const res = await request(app)
        .get(`/api/v1/${projectId}/replay/available`)
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.sessionIds).toEqual([]);
    });

    it("refuses a signed-in user who is not on the project", async () => {
      await ingest("with-replay", 0);

      const res = await request(app)
        .get(`/api/v1/${projectId}/replay/available`)
        .query({ sessionIds: "with-replay" })
        .set("Authorization", `Bearer ${strangerToken}`);

      expect(res.status).toBe(403);
    });
  });
});
