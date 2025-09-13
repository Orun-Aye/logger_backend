"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertRuleModel = void 0;
const mongoose_1 = require("mongoose");
const AlertRuleSchema = new mongoose_1.Schema({
    projectId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Project", required: true },
    name: { type: String, required: true },
    condition: {
        level: {
            type: String,
            enum: ["trace", "debug", "info", "warn", "error", "fatal"],
        },
        keyword: { type: String },
        frequency: { type: Number },
        intervalMinutes: { type: Number, default: 10 },
    },
    isActive: { type: Boolean, default: true },
    notifyChannels: {
        type: [String],
        enum: ["email", "slack", "webhook"],
        default: ["email"],
    },
    notificationConfig: {
        type: Object,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
}, { timestamps: true });
exports.AlertRuleModel = (0, mongoose_1.model)("AlertRule", AlertRuleSchema);
