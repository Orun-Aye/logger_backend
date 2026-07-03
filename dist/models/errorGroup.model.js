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
exports.ErrorGroupModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const LinkedIssueSchema = new mongoose_1.Schema({
    provider: { type: String, enum: ["github"], required: true },
    repo: { type: String, required: true },
    number: { type: Number, required: true },
    url: { type: String, required: true },
    state: { type: String, enum: ["open", "closed"], default: "open" },
    linkedAt: { type: Date, default: Date.now },
    linkedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
}, { _id: false });
const SuspectCommitSchema = new mongoose_1.Schema({
    sha: { type: String, required: true },
    score: { type: Number, required: true },
    rationale: { type: String },
    message: { type: String },
    htmlUrl: { type: String },
    authorLogin: { type: String },
}, { _id: false });
const ErrorGroupSchema = new mongoose_1.Schema({
    projectId: {
        type: String,
        required: true,
        index: true,
    },
    fingerprint: {
        type: String,
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    errorName: {
        type: String,
    },
    sampleMessage: {
        type: String,
        required: true,
    },
    sampleStack: {
        type: String,
    },
    sampleLogId: {
        type: String,
    },
    firstSeen: {
        type: Date,
        required: true,
        default: Date.now,
    },
    lastSeen: {
        type: Date,
        required: true,
        default: Date.now,
    },
    count: {
        type: Number,
        default: 1,
    },
    sessionCount: {
        type: Number,
        default: 0,
    },
    sessionSample: {
        type: [String],
        default: [],
    },
    environments: {
        type: [String],
        default: [],
    },
    services: {
        type: [String],
        default: [],
    },
    releaseFirstSeen: {
        type: String,
    },
    releaseLastSeen: {
        type: String,
    },
    status: {
        type: String,
        enum: ["unresolved", "resolved", "ignored"],
        default: "unresolved",
    },
    resolvedAt: {
        type: Date,
    },
    resolvedBy: {
        type: String,
    },
    regressed: {
        type: Boolean,
        default: false,
    },
    regressedAt: {
        type: Date,
    },
    lastNotifiedAt: {
        type: Date,
    },
    aiSummary: {
        type: String,
    },
    linkedIssue: {
        type: LinkedIssueSchema,
        default: undefined,
    },
    suspectCommits: {
        type: [SuspectCommitSchema],
        default: undefined,
    },
    suspectCommitsComputedAt: {
        type: Date,
    },
}, {
    timestamps: true,
});
ErrorGroupSchema.index({ projectId: 1, fingerprint: 1 }, { unique: true });
ErrorGroupSchema.index({ projectId: 1, lastSeen: -1 });
ErrorGroupSchema.index({ projectId: 1, status: 1, lastSeen: -1 });
ErrorGroupSchema.index({ projectId: 1, count: -1 });
ErrorGroupSchema.index({
    "linkedIssue.repo": 1,
    "linkedIssue.number": 1,
});
exports.ErrorGroupModel = mongoose_1.default.model("ErrorGroup", ErrorGroupSchema);
