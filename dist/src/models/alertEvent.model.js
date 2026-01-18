"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertEventModel = void 0;
const mongoose_1 = require("mongoose");
const AlertEventSchema = new mongoose_1.Schema({
    projectId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    ruleId: { type: mongoose_1.Schema.Types.ObjectId, ref: "AlertRule" },
    logId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Log" },
    title: { type: String, required: true },
    message: { type: String, required: true },
    severity: { type: String, enum: ["info", "warning", "critical"], default: "warning", index: true },
    notifyChannels: { type: [String], enum: ["email", "slack", "webhook"], default: ["email"] },
    tags: { type: [String] },
    metadata: { type: mongoose_1.Schema.Types.Mixed },
    status: { type: String, enum: ["active", "acknowledged", "resolved", "snoozed"], default: "active" },
    acknowledgedAt: { type: Date },
    triggeredAt: { type: Date, default: () => new Date() },
}, { timestamps: true });
AlertEventSchema.index({ projectId: 1, triggeredAt: -1 });
exports.AlertEventModel = (0, mongoose_1.model)("AlertEvent", AlertEventSchema);
