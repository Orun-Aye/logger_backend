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
exports.LogModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const LogSchema = new mongoose_1.Schema({
    projectId: {
        type: String,
        required: true,
        index: true,
    },
    timestamp: {
        type: String,
        required: true,
        default: () => new Date().toISOString(),
    },
    level: {
        type: String,
        required: true,
        enum: ["trace", "debug", "info", "warn", "error", "fatal"],
    },
    message: {
        type: String,
        required: true,
    },
    data: {
        type: mongoose_1.Schema.Types.Mixed,
    },
    error: {
        name: String,
        message: String,
        stack: String,
        url: String,
        lineNumber: Number,
        columnNumber: Number,
    },
    service: {
        type: String,
        default: "unknown-service",
    },
    environment: {
        type: String,
        default: "development",
    },
    context: {
        type: mongoose_1.Schema.Types.Mixed,
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
    },
    eventType: {
        type: String,
        enum: ['error', 'performance', 'interaction', 'network', 'console', 'pageview'],
        index: true, // Good for filtering by event type
    },
    userAgent: {
        type: String,
    },
    url: {
        type: String,
        index: true, // Good for filtering by URL
    },
    referrer: {
        type: String,
    },
}, {
    timestamps: true, // adds createdAt and updatedAt
});
// ✅ ADDED - Additional indexes for better query performance
LogSchema.index({ projectId: 1, timestamp: -1 }); // Common query pattern
LogSchema.index({ projectId: 1, level: 1 }); // Filter by project and log level
LogSchema.index({ projectId: 1, eventType: 1 }); // Filter by project and event type
LogSchema.index({ url: 1, timestamp: -1 }); // URL-based queries with recency
exports.LogModel = mongoose_1.default.model("Log", LogSchema);
