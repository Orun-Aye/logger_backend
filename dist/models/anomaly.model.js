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
exports.AnomalyModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const AnomalySchema = new mongoose_1.Schema({
    projectId: {
        type: String,
        required: true,
        index: true,
    },
    type: {
        type: String,
        required: true,
        enum: [
            "log_volume_spike",
            "error_rate_increase",
            "response_time_degradation",
            "error_spike",
        ],
    },
    severity: {
        type: String,
        required: true,
        enum: ["critical", "warning", "info"],
    },
    metric: {
        type: String,
        required: true,
    },
    currentValue: {
        type: Number,
        required: true,
    },
    baselineValue: {
        type: Number,
        required: true,
    },
    deviation: {
        type: Number,
        required: true,
    },
    percentChange: {
        type: Number,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    detectedAt: {
        type: Date,
        required: true,
        default: Date.now,
    },
    resolvedAt: {
        type: Date,
        default: null,
    },
    acknowledged: {
        type: Boolean,
        default: false,
    },
    acknowledgedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
}, {
    timestamps: true,
});
// Compound indexes for common queries
AnomalySchema.index({ projectId: 1, detectedAt: -1 });
AnomalySchema.index({ projectId: 1, type: 1, resolvedAt: 1 });
// TTL index: auto-delete anomalies older than 90 days
AnomalySchema.index({ detectedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
exports.AnomalyModel = mongoose_1.default.model("Anomaly", AnomalySchema);
