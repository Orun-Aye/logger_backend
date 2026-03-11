"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Mock server module (WebSocket service)
jest.mock("../../server", () => ({
    globalServices: {
        dashboardWebSocketService: null,
    },
}));
// Mock notification service to prevent actual emails/webhooks
jest.mock("../../services/notification.service", () => ({
    NotificationService: {
        sendEmail: jest.fn().mockResolvedValue(undefined),
        sendSlack: jest.fn().mockResolvedValue(undefined),
        sendWebhook: jest.fn().mockResolvedValue(undefined),
    },
}));
const alert_service_1 = require("../../services/alert.service");
const alertEvent_model_1 = require("../../models/alertEvent.model");
const factories_1 = require("../factories");
describe("AlertService", () => {
    let userId;
    let projectId;
    let projectObjectId;
    beforeEach(async () => {
        const user = await (0, factories_1.createTestUser)();
        userId = user._id.toString();
        const project = await (0, factories_1.createTestProject)(user._id);
        projectId = project._id.toString();
        projectObjectId = project._id;
    });
    // ----- evaluateLogAndTrigger -----
    describe("evaluateLogAndTrigger", () => {
        it("should create an alert event when log matches a rule", async () => {
            // Create an active rule for error logs
            await (0, factories_1.createTestAlertRule)(projectObjectId, {
                condition: { level: "error" },
                isActive: true,
            });
            // Create an error log that should trigger
            const log = await (0, factories_1.createTestLog)(projectId, {
                level: "error",
                message: "Critical failure",
            });
            await alert_service_1.AlertService.evaluateLogAndTrigger(log.toObject());
            const alerts = await alertEvent_model_1.AlertEventModel.find({ projectId: projectObjectId });
            expect(alerts.length).toBe(1);
            expect(alerts[0].severity).toBe("critical");
            expect(alerts[0].status).toBe("active");
        });
        it("should not trigger when log level does not match rule", async () => {
            await (0, factories_1.createTestAlertRule)(projectObjectId, {
                condition: { level: "fatal" },
                isActive: true,
            });
            const log = await (0, factories_1.createTestLog)(projectId, {
                level: "info",
                message: "Normal info log",
            });
            await alert_service_1.AlertService.evaluateLogAndTrigger(log.toObject());
            const alerts = await alertEvent_model_1.AlertEventModel.find({ projectId: projectObjectId });
            expect(alerts.length).toBe(0);
        });
        it("should not trigger when rule is inactive", async () => {
            await (0, factories_1.createTestAlertRule)(projectObjectId, {
                condition: { level: "error" },
                isActive: false,
            });
            const log = await (0, factories_1.createTestLog)(projectId, {
                level: "error",
                message: "Error on inactive rule",
            });
            await alert_service_1.AlertService.evaluateLogAndTrigger(log.toObject());
            const alerts = await alertEvent_model_1.AlertEventModel.find({ projectId: projectObjectId });
            expect(alerts.length).toBe(0);
        });
        it("should not trigger when rule is snoozed", async () => {
            const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
            await (0, factories_1.createTestAlertRule)(projectObjectId, {
                condition: { level: "error" },
                isActive: true,
                snoozeUntil: futureDate,
            });
            const log = await (0, factories_1.createTestLog)(projectId, {
                level: "error",
                message: "Snoozed rule error",
            });
            await alert_service_1.AlertService.evaluateLogAndTrigger(log.toObject());
            const alerts = await alertEvent_model_1.AlertEventModel.find({ projectId: projectObjectId });
            expect(alerts.length).toBe(0);
        });
        it("should match keyword condition", async () => {
            await (0, factories_1.createTestAlertRule)(projectObjectId, {
                condition: { keyword: "timeout" },
                isActive: true,
            });
            const log = await (0, factories_1.createTestLog)(projectId, {
                level: "error",
                message: "Connection timeout occurred",
            });
            await alert_service_1.AlertService.evaluateLogAndTrigger(log.toObject());
            const alerts = await alertEvent_model_1.AlertEventModel.find({ projectId: projectObjectId });
            expect(alerts.length).toBe(1);
        });
    });
    // ----- getAlerts -----
    describe("getAlerts", () => {
        it("should return alerts for a project", async () => {
            await (0, factories_1.createTestAlertEvent)(projectObjectId, { severity: "critical" });
            await (0, factories_1.createTestAlertEvent)(projectObjectId, { severity: "warning" });
            const result = await alert_service_1.AlertService.getAlerts({ projectId });
            expect(result.alerts.length).toBe(2);
            expect(result.total).toBe(2);
        });
        it("should filter alerts by severity", async () => {
            await (0, factories_1.createTestAlertEvent)(projectObjectId, { severity: "critical" });
            await (0, factories_1.createTestAlertEvent)(projectObjectId, { severity: "warning" });
            const result = await alert_service_1.AlertService.getAlerts({
                projectId,
                severity: "critical",
            });
            expect(result.alerts.length).toBe(1);
            expect(result.alerts[0].severity).toBe("critical");
        });
        it("should filter alerts by status", async () => {
            await (0, factories_1.createTestAlertEvent)(projectObjectId, { status: "active" });
            await (0, factories_1.createTestAlertEvent)(projectObjectId, { status: "resolved" });
            const result = await alert_service_1.AlertService.getAlerts({
                projectId,
                status: "active",
            });
            expect(result.alerts.length).toBe(1);
        });
        it("should paginate results", async () => {
            for (let i = 0; i < 5; i++) {
                await (0, factories_1.createTestAlertEvent)(projectObjectId);
            }
            const result = await alert_service_1.AlertService.getAlerts({
                projectId,
                limit: 2,
                offset: 0,
            });
            expect(result.alerts.length).toBe(2);
            expect(result.total).toBe(5);
        });
        it("should return alerts scoped by userId when no projectId", async () => {
            await (0, factories_1.createTestAlertEvent)(projectObjectId);
            const result = await alert_service_1.AlertService.getAlerts({ userId });
            expect(result.alerts.length).toBe(1);
        });
    });
    // ----- getAlertStats -----
    describe("getAlertStats", () => {
        it("should return correct statistics", async () => {
            await (0, factories_1.createTestAlertEvent)(projectObjectId, {
                status: "active",
                severity: "critical",
            });
            await (0, factories_1.createTestAlertEvent)(projectObjectId, {
                status: "active",
                severity: "warning",
            });
            await (0, factories_1.createTestAlertEvent)(projectObjectId, {
                status: "resolved",
                severity: "info",
            });
            const stats = await alert_service_1.AlertService.getAlertStats({ projectId });
            expect(stats.total).toBe(3);
            expect(stats.active).toBe(2);
            expect(stats.resolved).toBe(1);
            expect(stats.bySeverity.critical).toBe(1);
            expect(stats.bySeverity.warning).toBe(1);
            expect(stats.bySeverity.info).toBe(1);
        });
        it("should return zeros when no alerts exist", async () => {
            const stats = await alert_service_1.AlertService.getAlertStats({ projectId });
            expect(stats.total).toBe(0);
            expect(stats.active).toBe(0);
        });
    });
    // ----- updateAlertStatus -----
    describe("updateAlertStatus", () => {
        it("should acknowledge an alert", async () => {
            const alert = await (0, factories_1.createTestAlertEvent)(projectObjectId, {
                status: "active",
            });
            const result = await alert_service_1.AlertService.updateAlertStatus(alert._id.toString(), "acknowledged", userId);
            expect(result).not.toBeNull();
            expect(result.status).toBe("acknowledged");
            expect(result.acknowledgedAt).toBeDefined();
        });
        it("should resolve an alert with notes", async () => {
            const alert = await (0, factories_1.createTestAlertEvent)(projectObjectId, {
                status: "active",
            });
            const result = await alert_service_1.AlertService.updateAlertStatus(alert._id.toString(), "resolved", userId, "Fixed the root cause");
            expect(result).not.toBeNull();
            expect(result.status).toBe("resolved");
            expect(result.resolvedAt).toBeDefined();
            expect(result.resolutionNotes).toBe("Fixed the root cause");
        });
    });
    // ----- bulkUpdateAlerts -----
    describe("bulkUpdateAlerts", () => {
        it("should update multiple alerts at once", async () => {
            const a1 = await (0, factories_1.createTestAlertEvent)(projectObjectId, {
                status: "active",
            });
            const a2 = await (0, factories_1.createTestAlertEvent)(projectObjectId, {
                status: "active",
            });
            const result = await alert_service_1.AlertService.bulkUpdateAlerts([a1._id.toString(), a2._id.toString()], "acknowledged");
            expect(result.modifiedCount).toBe(2);
        });
    });
    // ----- autoResolveOldAlerts -----
    describe("autoResolveOldAlerts", () => {
        it("should auto-resolve alerts older than specified days", async () => {
            const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
            await (0, factories_1.createTestAlertEvent)(projectObjectId, {
                status: "active",
                triggeredAt: oldDate,
            });
            await (0, factories_1.createTestAlertEvent)(projectObjectId, {
                status: "active",
                triggeredAt: new Date(), // recent
            });
            const result = await alert_service_1.AlertService.autoResolveOldAlerts(30);
            expect(result.modifiedCount).toBe(1);
            // Verify only old alert was resolved
            const active = await alertEvent_model_1.AlertEventModel.find({ status: "active" });
            expect(active.length).toBe(1);
        });
    });
    // ----- deleteAlerts -----
    describe("deleteAlerts", () => {
        it("should soft-delete alerts by default", async () => {
            const alert = await (0, factories_1.createTestAlertEvent)(projectObjectId);
            await alert_service_1.AlertService.deleteAlerts([alert._id.toString()]);
            const updated = await alertEvent_model_1.AlertEventModel.findById(alert._id);
            expect(updated.status).toBe("resolved");
        });
        it("should hard-delete when softDelete is false", async () => {
            const alert = await (0, factories_1.createTestAlertEvent)(projectObjectId);
            await alert_service_1.AlertService.deleteAlerts([alert._id.toString()], false);
            const deleted = await alertEvent_model_1.AlertEventModel.findById(alert._id);
            expect(deleted).toBeNull();
        });
    });
});
