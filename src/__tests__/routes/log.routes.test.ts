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
  },
}));

import request from "supertest";
import app from "../app";
import { LogModel } from "../../models/log.model";
import {
  createTestUser,
  createTestProject,
  createTestLog,
  generateAuthToken,
} from "../factories";

describe("Log Routes", () => {
  let userId: string;
  let projectId: string;
  let apiKey: string;
  let authToken: string;

  beforeEach(async () => {
    const user = await createTestUser();
    userId = user._id.toString();
    authToken = generateAuthToken(user._id as any);

    const project = await createTestProject(user._id as any);
    projectId = project._id.toString();
    apiKey = project.apiKey;
  });

  // ----- POST /:projectId/logs (API Key Auth) -----
  describe("POST /:projectId/logs", () => {
    it("should create a log entry with valid API key", async () => {
      const res = await request(app)
        .post(`/api/v1/${projectId}/logs`)
        .set("X-API-Key", apiKey)
        .send({
          level: "info",
          message: "Test log from integration test",
          service: "test-service",
          environment: "test",
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe("success");
      expect(res.body.data).toHaveProperty("_id");
      expect(res.body.data.message).toBe("Test log from integration test");
    });

    it("should return 401 without API key", async () => {
      const res = await request(app)
        .post(`/api/v1/${projectId}/logs`)
        .send({
          level: "info",
          message: "No API key",
        });

      expect(res.status).toBe(401);
    });

    it("should return 403 with invalid API key", async () => {
      const res = await request(app)
        .post(`/api/v1/${projectId}/logs`)
        .set("X-API-Key", "invalid-api-key")
        .send({
          level: "info",
          message: "Bad API key",
        });

      expect(res.status).toBe(403);
    });

    it("should create a log with error details", async () => {
      const res = await request(app)
        .post(`/api/v1/${projectId}/logs`)
        .set("X-API-Key", apiKey)
        .send({
          level: "error",
          message: "Critical error",
          error: {
            name: "TypeError",
            message: "Cannot read property 'x' of undefined",
            stack: "TypeError: Cannot read...",
          },
          service: "api",
          environment: "production",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.error.name).toBe("TypeError");
    });

    it("should accept different log levels", async () => {
      const levels = ["trace", "debug", "info", "warn", "error", "fatal"];

      for (const level of levels) {
        const res = await request(app)
          .post(`/api/v1/${projectId}/logs`)
          .set("X-API-Key", apiKey)
          .send({
            level,
            message: `${level} level log`,
          });

        expect(res.status).toBe(201);
        expect(res.body.data.level).toBe(level);
      }
    });
  });

  // ----- GET /:projectId/logs (JWT Auth) -----
  describe("GET /:projectId/logs", () => {
    beforeEach(async () => {
      await createTestLog(projectId, {
        level: "info",
        message: "Info log",
        service: "api",
      });
      await createTestLog(projectId, {
        level: "error",
        message: "Error log",
        service: "worker",
      });
      await createTestLog(projectId, {
        level: "warn",
        message: "Warning log",
        service: "api",
      });
    });

    it("should return logs with JWT auth", async () => {
      const res = await request(app)
        .get(`/api/v1/${projectId}/logs`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.length).toBe(3);
      expect(res.body.meta.pagination).toBeDefined();
    });

    it("should return 401 without JWT", async () => {
      const res = await request(app).get(`/api/v1/${projectId}/logs`);

      expect(res.status).toBe(401);
    });

    it("should filter by level", async () => {
      const res = await request(app)
        .get(`/api/v1/${projectId}/logs?level=error`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].level).toBe("error");
    });

    it("should filter by service", async () => {
      const res = await request(app)
        .get(`/api/v1/${projectId}/logs?service=api`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
    });

    it("should paginate results", async () => {
      const res = await request(app)
        .get(`/api/v1/${projectId}/logs?page=1&limit=2`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.meta.pagination.totalRecords).toBe(3);
    });

    it("should search by message content", async () => {
      const res = await request(app)
        .get(`/api/v1/${projectId}/logs?search=Error`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
    });
  });

  // ----- GET /:projectId/logs/summary (JWT Auth) -----
  describe("GET /:projectId/logs/summary", () => {
    beforeEach(async () => {
      await createTestLog(projectId, { level: "info" });
      await createTestLog(projectId, { level: "error" });
      await createTestLog(projectId, { level: "error" });
    });

    it("should return log summary statistics", async () => {
      const res = await request(app)
        .get(`/api/v1/${projectId}/logs/summary`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.totalLogs).toBe(3);
      expect(res.body.data.byLevel).toBeDefined();
    });

    it("should return 401 without auth", async () => {
      const res = await request(app).get(
        `/api/v1/${projectId}/logs/summary`
      );

      expect(res.status).toBe(401);
    });
  });

  // ----- DELETE /:projectId/logs (JWT Auth) -----
  describe("DELETE /:projectId/logs", () => {
    beforeEach(async () => {
      await createTestLog(projectId, { level: "info" });
      await createTestLog(projectId, { level: "error" });
      await createTestLog(projectId, { level: "error" });
    });

    it("should delete logs matching level filter", async () => {
      const res = await request(app)
        .delete(`/api/v1/${projectId}/logs?level=error`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.deletedCount).toBe(2);

      // Verify only info log remains
      const remaining = await LogModel.countDocuments({ projectId });
      expect(remaining).toBe(1);
    });

    it("should return 401 without auth", async () => {
      const res = await request(app).delete(
        `/api/v1/${projectId}/logs?level=error`
      );

      expect(res.status).toBe(401);
    });
  });
});
