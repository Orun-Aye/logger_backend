"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Mock the server module before any imports that use it
jest.mock("../../server", () => ({
    globalServices: {
        dashboardWebSocketService: null,
    },
}));
const mongoose_1 = require("mongoose");
const log_service_1 = require("../../services/log.service");
const log_model_1 = require("../../models/log.model");
const factories_1 = require("../factories");
const log_dto_1 = require("../../dtos/log.dto");
describe("LogService", () => {
    let projectId;
    beforeEach(async () => {
        const user = await (0, factories_1.createTestUser)();
        const project = await (0, factories_1.createTestProject)(user._id);
        projectId = project._id.toString();
    });
    // ----- createLog -----
    describe("createLog", () => {
        it("should create a log entry with valid data", async () => {
            const result = await log_service_1.LogService.createLog({
                projectId,
                level: log_dto_1.LogLevel.INFO,
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
            const result = await log_service_1.LogService.createLog({
                projectId,
                timestamp: now,
                level: log_dto_1.LogLevel.INFO,
                message: "Timestamped log",
            });
            expect(result.timestamp).toBe(now.toISOString());
        });
        it("should auto-generate timestamp if not provided", async () => {
            const result = await log_service_1.LogService.createLog({
                projectId,
                level: log_dto_1.LogLevel.DEBUG,
                message: "No timestamp",
            });
            expect(result.timestamp).toBeDefined();
            // Verify it's a valid ISO string
            expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
        });
        it("should throw LogValidationError for invalid projectId", async () => {
            await expect(log_service_1.LogService.createLog({
                projectId: "not-an-objectid",
                level: log_dto_1.LogLevel.INFO,
                message: "Bad project",
            })).rejects.toThrow(log_service_1.LogValidationError);
        });
        it("should reject duplicate log (same project, message, timestamp)", async () => {
            const timestamp = new Date();
            await log_service_1.LogService.createLog({
                projectId,
                timestamp,
                level: log_dto_1.LogLevel.INFO,
                message: "Duplicate me",
            });
            await expect(log_service_1.LogService.createLog({
                projectId,
                timestamp,
                level: log_dto_1.LogLevel.INFO,
                message: "Duplicate me",
            })).rejects.toThrow(log_service_1.LogServiceError);
        });
        it("should store error details when provided", async () => {
            const result = await log_service_1.LogService.createLog({
                projectId,
                level: log_dto_1.LogLevel.ERROR,
                message: "Something broke",
                error: {
                    name: "TypeError",
                    message: "Cannot read property 'x'",
                    stack: "TypeError: Cannot read...",
                },
            });
            expect(result.error).toBeDefined();
            expect(result.error.name).toBe("TypeError");
            expect(result.error.message).toBe("Cannot read property 'x'");
        });
        it("should track ingestion timing metrics", async () => {
            const result = await log_service_1.LogService.createLog({
                projectId,
                level: log_dto_1.LogLevel.INFO,
                message: "Timed log",
            });
            expect(result.ingestionStartTime).toBeDefined();
            expect(result.ingestionEndTime).toBeDefined();
            expect(result.ingestionLatency).toBeGreaterThanOrEqual(0);
        });
    });
    // ----- getAllLogs -----
    describe("getAllLogs", () => {
        beforeEach(async () => {
            // Create several logs with different attributes
            await (0, factories_1.createTestLog)(projectId, {
                level: "info",
                message: "Info log 1",
                service: "api",
                environment: "production",
            });
            await (0, factories_1.createTestLog)(projectId, {
                level: "error",
                message: "Error log 1",
                service: "worker",
                environment: "staging",
            });
            await (0, factories_1.createTestLog)(projectId, {
                level: "warn",
                message: "Warning log 1",
                service: "api",
                environment: "production",
            });
        });
        it("should return logs with pagination", async () => {
            const result = await log_service_1.LogService.getAllLogs({
                projectId,
                page: 1,
                limit: 10,
            });
            expect(result.logs.length).toBe(3);
            expect(result.pagination).toBeDefined();
            expect(result.pagination.totalRecords).toBe(3);
        });
        it("should filter by level", async () => {
            const result = await log_service_1.LogService.getAllLogs({
                projectId,
                level: log_dto_1.LogLevel.ERROR,
            });
            expect(result.logs.length).toBe(1);
            expect(result.logs[0].level).toBe("error");
        });
        it("should filter by multiple levels", async () => {
            const result = await log_service_1.LogService.getAllLogs({
                projectId,
                levels: [log_dto_1.LogLevel.INFO, log_dto_1.LogLevel.WARN],
            });
            expect(result.logs.length).toBe(2);
        });
        it("should filter by service", async () => {
            const result = await log_service_1.LogService.getAllLogs({
                projectId,
                service: "api",
            });
            expect(result.logs.length).toBe(2);
        });
        it("should filter by environment", async () => {
            const result = await log_service_1.LogService.getAllLogs({
                projectId,
                environment: "staging",
            });
            expect(result.logs.length).toBe(1);
        });
        it("should search by message content", async () => {
            const result = await log_service_1.LogService.getAllLogs({
                projectId,
                search: "Error log",
            });
            expect(result.logs.length).toBe(1);
            expect(result.logs[0].message).toContain("Error log");
        });
        it("should throw when projectId is missing", async () => {
            await expect(log_service_1.LogService.getAllLogs({ page: 1, limit: 10 })).rejects.toThrow(log_service_1.LogValidationError);
        });
        it("should respect pagination limits", async () => {
            const result = await log_service_1.LogService.getAllLogs({
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
            const log = await (0, factories_1.createTestLog)(projectId, { message: "Find me" });
            const result = await log_service_1.LogService.getLogById(log._id.toString());
            expect(result.message).toBe("Find me");
        });
        it("should throw LogNotFoundError for non-existent ID", async () => {
            const fakeId = new mongoose_1.Types.ObjectId().toString();
            await expect(log_service_1.LogService.getLogById(fakeId)).rejects.toThrow(log_service_1.LogNotFoundError);
        });
        it("should throw LogValidationError for invalid ID format", async () => {
            await expect(log_service_1.LogService.getLogById("bad-id")).rejects.toThrow(log_service_1.LogValidationError);
        });
    });
    // ----- getLogsSummary -----
    describe("getLogsSummary", () => {
        beforeEach(async () => {
            await (0, factories_1.createTestLog)(projectId, { level: "info", service: "api" });
            await (0, factories_1.createTestLog)(projectId, { level: "error", service: "worker" });
            await (0, factories_1.createTestLog)(projectId, { level: "error", service: "api" });
            await (0, factories_1.createTestLog)(projectId, { level: "warn", service: "api" });
        });
        it("should return summary statistics", async () => {
            const result = await log_service_1.LogService.getLogsSummary(projectId);
            expect(result.totalLogs).toBe(4);
            expect(result.byLevel).toBeDefined();
            expect(result.byService).toBeDefined();
            expect(result.metadata).toBeDefined();
            expect(result.metadata.projectId).toBe(projectId);
        });
        it("should count logs by level correctly", async () => {
            const result = await log_service_1.LogService.getLogsSummary(projectId);
            expect(result.byLevel.error).toBe(2);
            expect(result.byLevel.warn).toBe(1);
            expect(result.byLevel.info).toBe(1);
        });
        it("should count logs by service correctly", async () => {
            const result = await log_service_1.LogService.getLogsSummary(projectId);
            expect(result.byService.api).toBe(3);
            expect(result.byService.worker).toBe(1);
        });
        it("should throw for invalid projectId", async () => {
            await expect(log_service_1.LogService.getLogsSummary("invalid-id")).rejects.toThrow(log_service_1.LogValidationError);
        });
    });
    // ----- getLogTrends -----
    describe("getLogTrends", () => {
        it("should return trend data grouped by day by default", async () => {
            await (0, factories_1.createTestLog)(projectId, { level: "info" });
            await (0, factories_1.createTestLog)(projectId, { level: "error" });
            const result = await log_service_1.LogService.getLogTrends(projectId);
            expect(result.trends).toBeDefined();
            expect(Array.isArray(result.trends)).toBe(true);
            expect(result.metadata).toBeDefined();
        });
        it("should throw for invalid projectId", async () => {
            await expect(log_service_1.LogService.getLogTrends("invalid-id")).rejects.toThrow(log_service_1.LogValidationError);
        });
    });
    // ----- deleteLogs -----
    describe("deleteLogs", () => {
        it("should delete logs matching filters", async () => {
            await (0, factories_1.createTestLog)(projectId, { level: "info" });
            await (0, factories_1.createTestLog)(projectId, { level: "error" });
            await (0, factories_1.createTestLog)(projectId, { level: "error" });
            const result = await log_service_1.LogService.deleteLogs({
                projectId,
                level: log_dto_1.LogLevel.ERROR,
            });
            expect(result.deletedCount).toBe(2);
            // Verify remaining logs
            const remaining = await log_model_1.LogModel.countDocuments({ projectId });
            expect(remaining).toBe(1);
        });
        it("should throw when projectId is missing", async () => {
            await expect(log_service_1.LogService.deleteLogs({ level: log_dto_1.LogLevel.ERROR })).rejects.toThrow(log_service_1.LogValidationError);
        });
        it("should throw when only projectId is specified (safety guard)", async () => {
            await expect(log_service_1.LogService.deleteLogs({ projectId })).rejects.toThrow(log_service_1.LogValidationError);
        });
    });
    // ----- getDistinctValues -----
    describe("getDistinctValues", () => {
        it("should return distinct service values", async () => {
            await (0, factories_1.createTestLog)(projectId, { service: "api" });
            await (0, factories_1.createTestLog)(projectId, { service: "worker" });
            await (0, factories_1.createTestLog)(projectId, { service: "api" }); // duplicate
            const result = await log_service_1.LogService.getDistinctValues(projectId, "service");
            expect(result).toContain("api");
            expect(result).toContain("worker");
            expect(result.length).toBe(2);
        });
        it("should return distinct level values", async () => {
            await (0, factories_1.createTestLog)(projectId, { level: "info" });
            await (0, factories_1.createTestLog)(projectId, { level: "error" });
            const result = await log_service_1.LogService.getDistinctValues(projectId, "level");
            expect(result).toContain("info");
            expect(result).toContain("error");
        });
    });
});
