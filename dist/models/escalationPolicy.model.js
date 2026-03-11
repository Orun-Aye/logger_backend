"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EscalationPolicyModel = void 0;
const mongoose_1 = require("mongoose");
const EscalationLevelSchema = new mongoose_1.Schema({
    level: { type: Number, required: true },
    delayMinutes: { type: Number, required: true, min: 0 },
    notifyChannels: {
        type: [String],
        enum: ["email", "slack", "webhook"],
        required: true,
    },
    recipients: { type: [String], required: true },
    webhookUrl: { type: String },
}, { _id: false });
const EscalationPolicySchema = new mongoose_1.Schema({
    projectId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Project",
        required: true,
        index: true,
    },
    name: { type: String, required: true },
    description: { type: String },
    levels: {
        type: [EscalationLevelSchema],
        required: true,
        validate: {
            validator: (levels) => levels.length > 0,
            message: "At least one escalation level is required",
        },
    },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });
// Index for efficient queries
EscalationPolicySchema.index({ projectId: 1, isActive: 1 });
EscalationPolicySchema.index({ createdAt: -1 });
exports.EscalationPolicyModel = (0, mongoose_1.model)("EscalationPolicy", EscalationPolicySchema);
