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
exports.CommitModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const CommitFileSchema = new mongoose_1.Schema({
    filename: { type: String, required: true },
    status: { type: String, required: true },
    additions: { type: Number },
    deletions: { type: Number },
}, { _id: false });
const CommitSchema = new mongoose_1.Schema({
    projectId: {
        type: String,
        required: true,
        index: true,
    },
    sha: {
        type: String,
        required: true,
    },
    message: {
        type: String,
        required: true,
    },
    authorName: {
        type: String,
        required: true,
    },
    authorEmail: {
        type: String,
    },
    authorLogin: {
        type: String,
    },
    authorAvatarUrl: {
        type: String,
    },
    committedAt: {
        type: Date,
        required: true,
    },
    branch: {
        type: String,
    },
    htmlUrl: {
        type: String,
    },
    additions: {
        type: Number,
    },
    deletions: {
        type: Number,
    },
    filesChanged: {
        type: Number,
    },
    files: {
        type: [CommitFileSchema],
        default: undefined,
    },
    pushId: {
        type: String,
    },
    aiSummary: {
        type: String,
    },
    aiTechnicalSummary: {
        type: String,
    },
    aiExplanation: {
        type: String,
    },
    aiSummaryStatus: {
        type: String,
        enum: ["pending", "complete", "skipped", "failed"],
        default: "pending",
    },
    source: {
        type: String,
        enum: ["webhook", "backfill"],
        default: "webhook",
    },
}, {
    timestamps: true,
});
// One document per commit per project (a repo can be linked to several projects)
CommitSchema.index({ projectId: 1, sha: 1 }, { unique: true });
CommitSchema.index({ projectId: 1, committedAt: -1 });
CommitSchema.index({ projectId: 1, aiSummaryStatus: 1 });
exports.CommitModel = mongoose_1.default.model("Commit", CommitSchema);
