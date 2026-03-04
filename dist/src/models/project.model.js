"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectModel = void 0;
const mongoose_1 = require("mongoose");
const ProjectSchema = new mongoose_1.Schema({
    _id: { type: mongoose_1.Schema.Types.ObjectId, auto: true },
    name: { type: String, required: true, unique: true },
    apiKey: { type: String, required: true, unique: true },
    description: { type: String },
    ownerId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true }, // Reference to User model
    teamMembers: [
        {
            user: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
            role: { type: String, enum: ["viewer", "admin"], default: "viewer" }
        }
    ],
    isActive: { type: Boolean, default: true },
    logCount: { type: Number, default: 0 },
    alertRuleCount: { type: Number, default: 0 },
    integrationSettings: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    rateLimitConfig: {
        maxRequestsPerMinute: { type: Number, default: 100 },
        burstLimit: { type: Number, default: 10 }
    },
    tags: { type: [String], default: [] },
    lastIngestedAt: { type: Date },
    retentionConfig: {
        retentionDays: { type: Number, default: 30 },
        autoCleanupEnabled: { type: Boolean, default: true },
    },
    samplingConfig: {
        enabled: { type: Boolean, default: false },
        mode: { type: String, enum: ["rate", "percentage"], default: "percentage" },
        value: { type: Number, default: 100, min: 1, max: 1000 },
        alwaysKeepLevels: { type: [String], default: ["error", "fatal"] },
    },
}, {
    timestamps: true,
});
exports.ProjectModel = (0, mongoose_1.model)("Project", ProjectSchema);
