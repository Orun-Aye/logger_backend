"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const IntegrationSchema = new mongoose_1.Schema({
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Organization" },
    projectId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Project" },
    type: {
        type: String,
        required: true,
        enum: ["github", "jira", "pagerduty", "discord", "teams", "linear"],
    },
    status: {
        type: String,
        required: true,
        enum: ["connected", "disconnected", "error"],
        default: "disconnected",
    },
    config: {
        accessToken: { type: String },
        refreshToken: { type: String },
        webhookUrl: { type: String },
        baseUrl: { type: String },
        repo: { type: String },
        project: { type: String },
        serviceId: { type: String },
        channelId: { type: String },
        teamId: { type: String },
        email: { type: String },
    },
    metadata: {
        installationId: { type: String },
        workspaceName: { type: String },
        lastSyncAt: { type: Date },
        syncErrors: { type: [String], default: [] },
    },
    createdBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
}, {
    timestamps: true,
});
// Indexes
IntegrationSchema.index({ createdBy: 1 });
IntegrationSchema.index({ organizationId: 1 }, { sparse: true });
IntegrationSchema.index({ projectId: 1 }, { sparse: true });
IntegrationSchema.index({ type: 1, createdBy: 1 });
IntegrationSchema.index({ type: 1, projectId: 1 }, { sparse: true });
exports.IntegrationModel = mongoose_1.default.model("Integration", IntegrationSchema);
