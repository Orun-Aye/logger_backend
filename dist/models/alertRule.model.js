"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertRuleModel = void 0;
const mongoose_1 = require("mongoose");
const SimpleConditionSchema = new mongoose_1.Schema({
    level: {
        type: String,
        enum: ["trace", "debug", "info", "warn", "error", "fatal"],
    },
    keyword: { type: String },
    frequency: { type: Number },
    intervalMinutes: { type: Number, default: 10 },
    service: { type: String },
    environment: { type: String },
    responseTimeThreshold: { type: Number },
    eventType: { type: String },
}, { _id: false });
const AlertRuleSchema = new mongoose_1.Schema({
    projectId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    // Mixed type to support both simple and composite conditions
    condition: {
        type: mongoose_1.Schema.Types.Mixed,
        required: true,
    },
    isActive: { type: Boolean, default: true, index: true },
    notifyChannels: {
        type: [String],
        enum: ["email", "slack", "webhook", "github"],
        default: ["email"],
    },
    notificationConfig: {
        type: Object,
    },
    escalationPolicyId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "EscalationPolicy",
    },
    snoozeUntil: { type: Date },
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });
// Compound indexes for efficient queries
AlertRuleSchema.index({ projectId: 1, isActive: 1 });
AlertRuleSchema.index({ createdAt: -1 });
// Helper method to check if rule is snoozed
AlertRuleSchema.methods.isSnoozed = function () {
    return this.snoozeUntil && this.snoozeUntil > new Date();
};
// Helper to detect if condition is composite
AlertRuleSchema.methods.isCompositeCondition = function () {
    return this.condition && typeof this.condition === 'object' && 'operator' in this.condition;
};
exports.AlertRuleModel = (0, mongoose_1.model)("AlertRule", AlertRuleSchema);
