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
exports.DeploymentModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ImpactWindowSchema = new mongoose_1.Schema({
    logCount: { type: Number, required: true },
    errorCount: { type: Number, required: true },
    errorRate: { type: Number, required: true },
    avgResponseTime: { type: Number, default: null },
}, { _id: false });
const DeploymentSchema = new mongoose_1.Schema({
    projectId: {
        type: String,
        required: true,
        index: true,
    },
    kind: {
        type: String,
        enum: ["deployment", "release"],
        default: "deployment",
    },
    environment: {
        type: String,
        required: true,
        default: "production",
    },
    release: {
        type: String,
    },
    sha: {
        type: String,
    },
    status: {
        type: String,
        enum: ["pending", "in_progress", "success", "failure", "error", "inactive"],
        default: "success",
    },
    provider: {
        type: String,
        enum: ["github", "api"],
        required: true,
    },
    url: {
        type: String,
    },
    description: {
        type: String,
    },
    githubDeploymentId: {
        type: Number,
    },
    githubReleaseId: {
        type: Number,
    },
    deployedBy: {
        type: String,
    },
    startedAt: {
        type: Date,
        required: true,
        default: Date.now,
    },
    finishedAt: {
        type: Date,
    },
    impact: {
        verdict: {
            type: String,
            enum: ["healthy", "improved", "degraded", "unknown"],
        },
        computedAt: Date,
        windowMinutes: Number,
        before: ImpactWindowSchema,
        after: ImpactWindowSchema,
        errorRateChangePct: { type: Number, default: null },
        responseTimeChangePct: { type: Number, default: null },
    },
}, {
    timestamps: true,
});
DeploymentSchema.index({ projectId: 1, startedAt: -1 });
DeploymentSchema.index({ projectId: 1, githubDeploymentId: 1 }, { unique: true, sparse: true });
DeploymentSchema.index({ projectId: 1, githubReleaseId: 1 }, { unique: true, sparse: true });
DeploymentSchema.index({ projectId: 1, release: 1 });
exports.DeploymentModel = mongoose_1.default.model("Deployment", DeploymentSchema);
