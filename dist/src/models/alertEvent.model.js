"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertEventModel = void 0;
const mongoose_1 = require("mongoose");
const AlertEventSchema = new mongoose_1.Schema({
    projectId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    ruleId: { type: mongoose_1.Schema.Types.ObjectId, ref: "AlertRule", index: true },
    logId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Log" },
    title: { type: String, required: true },
    message: { type: String, required: true },
    severity: { type: String, enum: ["info", "warning", "critical"], default: "warning", index: true },
    notifyChannels: { type: [String], enum: ["email", "slack", "webhook"], default: ["email"] },
    tags: { type: [String] },
    environment: { type: String, index: true },
    service: { type: String, index: true },
    metadata: { type: mongoose_1.Schema.Types.Mixed },
    status: { type: String, enum: ["active", "acknowledged", "resolved", "snoozed"], default: "active", index: true },
    acknowledgedAt: { type: Date },
    acknowledgedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
    resolvedAt: { type: Date },
    resolvedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
    resolutionNotes: { type: String },
    snoozedUntil: { type: Date },
    snoozedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
    escalationLevel: { type: Number, default: 0 },
    lastEscalatedAt: { type: Date },
    occurenceCount: { type: Number, default: 1 },
    triggeredAt: { type: Date, default: () => new Date() },
}, { timestamps: true });
// Compound indexes for efficient queries
AlertEventSchema.index({ projectId: 1, triggeredAt: -1 });
AlertEventSchema.index({ projectId: 1, status: 1, severity: 1 });
AlertEventSchema.index({ ruleId: 1, status: 1 });
AlertEventSchema.index({ resolvedAt: 1 }); // For MTTR calculations
exports.AlertEventModel = (0, mongoose_1.model)("AlertEvent", AlertEventSchema);
