"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SDKConfigModel = void 0;
const mongoose_1 = require("mongoose");
const SDKConfigSchema = new mongoose_1.Schema({
    projectId: { type: String, required: true, unique: true, index: true },
    minLogLevel: { type: String, default: 'info' },
    batchSize: { type: Number, default: 10, min: 1, max: 100 },
    flushIntervalMs: { type: Number, default: 5000, min: 1000, max: 60000 },
    environment: { type: String },
    serviceName: { type: String },
    autoCapture: {
        errors: { type: Boolean, default: true },
        performance: { type: Boolean, default: true },
        userInteractions: { type: Boolean, default: false },
        networkRequests: { type: Boolean, default: true },
        consoleMessages: { type: Boolean, default: false },
        pageViews: { type: Boolean, default: true }
    },
    sanitization: {
        enabled: { type: Boolean, default: true },
        strictMode: { type: String, enum: ['STRICT', 'BALANCED', 'LENIENT'], default: 'BALANCED' },
        presetConfig: {
            auditEnabled: { type: Boolean, default: false },
            anonymizationEnabled: { type: Boolean, default: false },
            sensitiveFields: { type: Array, default: [] },
            retentionPolicy: {
                maxAge: { type: Number, default: 30 },
                maxSize: { type: Number, default: 10 },
                autoDelete: { type: Boolean, default: false },
                archiveBeforeDelete: { type: Boolean, default: false }
            }
        },
        customRules: [{
                pattern: { type: String },
                replacement: { type: String },
                description: { type: String },
                severity: { type: String },
                category: { type: String }
            }]
    }
}, { timestamps: true });
exports.SDKConfigModel = (0, mongoose_1.model)('SDKConfig', SDKConfigSchema);
