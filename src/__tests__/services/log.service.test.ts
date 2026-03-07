// Mock the server module before any imports that use it
jest.mock("../../server", () => ({
  globalServices: {
    dashboardWebSocketService: null,
  },
}));

import { Types } from "mongoose";
import {
  LogService,
  LogNotFoundError,
  LogValidationError,
  LogServiceError,
} from "../../services/log.service";
import { LogModel } from "../../models/log.model";
import { createTestUser, createTestProject, createTestLog } from "../factories";
import { LogLevel } from "../../dtos/log.dto";

describe("LogService", () => {
  let projectId: string;

  beforeEach(async () => {
    const user = await createTestUser();
    const project = await createTestProject(user._id as any);
    projectId = project._id.toString();
  });

  // ----- createLog -----
  describe("createLog", () => {
    it("should create a log entry with valid data", async () => {
      const result = await LogService.createLog({
        projectId,
        level: LogLevel.INFO,
        message: "Application started",
        service: "main",
        environment: "production",
      });

      expect(result).toHaveProperty("_id");
      expect(result.projectId).toBe(projectId);
      expect(result.level).toBe("info");
      expect(result.message).toBe("Application started");
      expect(result.ingestionSuccess).toBe(true);
    });

    it("should set timestamp to ISO string", async () => {
      const now = new Date();
      const result = await LogService.createLog({
        projectId,
        timestamp: now,
        level: LogLevel.INFO,
        message: "Timestamped log",
      });

      expect(result.timestamp).toBe(now.toISOString());
    });

    it("should auto-generate timestamp if not provided", async () => {
      const result = await LogService.createLog({
        projectId,
        level: LogLevel.DEBUG,
        message: "No timestamp",
      });

      expect(result.timestamp).toBeDefined();
      // Verify it's a valid ISO string
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });

    it("should throw LogValidationError for invalid projectId", async () => {
      await expect(
        LogService.createLog({
          projectId: "not-an-objectid",
          level: LogLevel.INFO,
          message: "Bad project",
        })
      ).rejects.toThrow(LogValidationError);
    });

    it("should reject duplicate log (same project, message, timestamp)", async () => {
      const timestamp = new Date();
      await LogService.createLog({
        projectId,
        timestamp,
        level: LogLevel.INFO,
        message: "Duplicate me",
      });

      await expect(
        LogService.createLog({
          projectId,
          timestamp,
          level: LogLevel.INFO,
          message: "Duplicate me",
        })
      ).rejects.toThrow(LogServiceError);
    });

    it("should store error details when provided", async () => {
      const result = await LogService.createLog({
        projectId,
        level: LogLevel.ERROR,
        message: "Something broke",
        error: {
          name: "TypeError",
          message: "Cannot read property 'x'",
          stack: "TypeError: Cannot read...",
        },
      });

      expect(result.error).toBeDefined();
      expect(result.error!.name).toBe("TypeError");
      expect(result.error!.message).toBe("Cannot read property 'x'");
    });

    it("should track ingestion timing metrics", async () => {
      const result = await LogService.createLog({
        projectId,
        level: LogLevel.INFO,
        message: "Timed log",
      });

      expect(result.ingestionStartTime).toBeDefined();
      expect(result.ingestionEndTime).toBeDefined();
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
    });
  });

  // ----- getAllLogs -----
  describe("getAllLogs", () => {
    beforeEach(async () => {
      // Create several logs with different attributes
      await createTestLog(projectId, {
        level: "info",
        message: "Info log 1",
        service: "api",
        environment: "production",
      });
      await createTestLog(projectId, {
        level: "error",
        message: "Error log 1",
        service: "worker",
        environment: "staging",
      });
      await createTestLog(projectId, {
        level: "warn",
        message: "Warning log 1",
        service: "api",
        environment: "production",
      });
    });

    it("should return logs with pagination", async () => {
      const result = await LogService.getAllLogs({
        projectId,
        page: 1,
        limit: 10,
      });

      expect(result.logs.length).toBe(3);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.totalRecords).toBe(3);
    });

    it("should filter by level", async () => {
      const result = await LogService.getAllLogs({
        projectId,
        level: LogLevel.ERROR,
      });

      expect(result.logs.length).toBe(1);
      expect(result.logs[0].level).toBe("error");
    });

    it("should filter by multiple levels", async () => {
      const result = await LogService.getAllLogs({
        projectId,
        levels: [LogLevel.INFO, LogLevel.WARN],
      });

      expect(result.logs.length).toBe(2);
    });

    it("should filter by service", async () => {
      const result = await LogService.getAllLogs({
        projectId,
        service: "api",
      });

      expect(result.logs.length).toBe(2);
    });

    it("should filter by environment", async () => {
      const result = await LogService.getAllLogs({
        projectId,
        environment: "staging",
      });

      expect(result.logs.length).toBe(1);
    });

    it("should search by message content", async () => {
      const result = await LogService.getAllLogs({
        projectId,
        search: "Error log",
      });

      expect(result.logs.length).toBe(1);
      expect(result.logs[0].message).toContain("Error log");
    });

    it("should throw when projectId is missing", async () => {
      await expect(
        LogService.getAllLogs({ page: 1, limit: 10 })
      ).rejects.toThrow(LogValidationError);
    });

    it("should respect pagination limits", async () => {
      const result = await LogService.getAllLogs({
        projectId,
        page: 1,
        limit: 2,
      });

      expect(result.logs.length).toBe(2);
      expect(result.pagination.totalRecords).toBe(3);
    });
  });

  // ----- getLogById -----
  describe("getLogById", () => {
    it("should return a log by its ID", async () => {
      const log = await createTestLog(projectId, { message: "Find me" });
      const result = await LogService.getLogById(log._id.toString());

      expect(result.message).toBe("Find me");
    });

    it("should throw LogNotFoundError for non-existent ID", async () => {
      const fakeId = new Types.ObjectId().toString();
      await expect(LogService.getLogById(fakeId)).rejects.toThrow(
        LogNotFoundError
      );
    });

    it("should throw LogValidationError for invalid ID format", async () => {
      await expect(LogService.getLogById("bad-id")).rejects.toThrow(
        LogValidationError
      );
    });
  });

  // ----- getLogsSummary -----
  describe("getLogsSummary", () => {
    beforeEach(async () => {
      await createTestLog(projectId, { level: "info", service: "api" });
      await createTestLog(projectId, { level: "error", service: "worker" });
      await createTestLog(projectId, { level: "error", service: "api" });
      await createTestLog(projectId, { level: "warn", service: "api" });
    });

    it("should return summary statistics", async () => {
      const result = await LogService.getLogsSummary(projectId);

      expect(result.totalLogs).toBe(4);
      expect(result.byLevel).toBeDefined();
      expect(result.byService).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.projectId).toBe(projectId);
    });

    it("should count logs by level correctly", async () => {
      const result = await LogService.getLogsSummary(projectId);

      expect(result.byLevel.error).toBe(2);
      expect(result.byLevel.warn).toBe(1);
      expect(result.byLevel.info).toBe(1);
    });

    it("should count logs by service correctly", async () => {
      const result = await LogService.getLogsSummary(projectId);

      expect(result.byService.api).toBe(3);
      expect(result.byService.worker).toBe(1);
    });

    it("should throw for invalid projectId", async () => {
      await expect(
        LogService.getLogsSummary("invalid-id")
      ).rejects.toThrow(LogValidationError);
    });
  });

  // ----- getLogTrends -----
  describe("getLogTrends", () => {
    it("should return trend data grouped by day by default", async () => {
      await createTestLog(projectId, { level: "info" });
      await createTestLog(projectId, { level: "error" });

      const result = await LogService.getLogTrends(projectId);

      expect(result.trends).toBeDefined();
      expect(Array.isArray(result.trends)).toBe(true);
      expect(result.metadata).toBeDefined();
    });

    it("should throw for invalid projectId", async () => {
      await expect(
        LogService.getLogTrends("invalid-id")
      ).rejects.toThrow(LogValidationError);
    });
  });

  // ----- deleteLogs -----
  describe("deleteLogs", () => {
    it("should delete logs matching filters", async () => {
      await createTestLog(projectId, { level: "info" });
      await createTestLog(projectId, { level: "error" });
      await createTestLog(projectId, { level: "error" });

      const result = await LogService.deleteLogs({
        projectId,
        level: LogLevel.ERROR,
      });

      expect(result.deletedCount).toBe(2);

      // Verify remaining logs
      const remaining = await LogModel.countDocuments({ projectId });
      expect(remaining).toBe(1);
    });

    it("should throw when projectId is missing", async () => {
      await expect(
        LogService.deleteLogs({ level: LogLevel.ERROR })
      ).rejects.toThrow(LogValidationError);
    });

    it("should throw when only projectId is specified (safety guard)", async () => {
      await expect(
        LogService.deleteLogs({ projectId })
      ).rejects.toThrow(LogValidationError);
    });
  });

  // ----- getDistinctValues -----
  describe("getDistinctValues", () => {
    it("should return distinct service values", async () => {
      await createTestLog(projectId, { service: "api" });
      await createTestLog(projectId, { service: "worker" });
      await createTestLog(projectId, { service: "api" }); // duplicate

      const result = await LogService.getDistinctValues(projectId, "service");

      expect(result).toContain("api");
      expect(result).toContain("worker");
      expect(result.length).toBe(2);
    });

    it("should return distinct level values", async () => {
      await createTestLog(projectId, { level: "info" });
      await createTestLog(projectId, { level: "error" });

      const result = await LogService.getDistinctValues(projectId, "level");

      expect(result).toContain("info");
      expect(result).toContain("error");
    });
  });
});
