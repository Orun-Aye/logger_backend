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
    integrationSettings: {
        slack: { webhookUrl: { type: String, default: "" } },
        email: { recipients: { type: [String], default: [] } },
        webhook: {
            url: { type: String, default: "" },
            headers: { type: mongoose_1.Schema.Types.Mixed, default: {} },
        },
        githubRepo: {
            type: {
                owner: { type: String, required: true },
                repo: { type: String, required: true },
                branch: { type: String, required: true, default: "main" },
                linkedAt: { type: Date, default: Date.now },
                linkedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
            },
            required: false,
            default: undefined,
        },
    },
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
    archivedAt: { type: Date },
    archiveReason: { type: String },
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Organization" },
}, {
    timestamps: true,
});
// Index for organization-scoped queries (sparse because field is optional)
ProjectSchema.index({ organizationId: 1 }, { sparse: true });
exports.ProjectModel = (0, mongoose_1.model)("Project", ProjectSchema);
