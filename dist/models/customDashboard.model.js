"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomDashboardModel = exports.WIDGET_METRICS = void 0;
const mongoose_1 = require("mongoose");
// Predefined metric data sources for widgets
exports.WIDGET_METRICS = [
    // General
    "log-volume", "error-count", "error-rate", "warning-count",
    "avg-response-time", "active-alerts", "health-score",
    // Performance
    "perf-fcp", "perf-lcp", "perf-cls", "perf-inp", "perf-ttfb",
    // Network
    "network-requests", "network-failure-rate", "network-avg-duration",
    "network-p95-duration", "network-errors",
    // Interactions
    "interaction-total", "interaction-clicks", "interaction-scrolls",
    "interaction-keypresses",
    // Console
    "console-total", "console-errors", "console-warnings", "console-error-rate",
    // Pageviews
    "pageview-total", "pageview-unique-pages", "pageview-bounce-rate",
];
const DashboardWidgetSchema = new mongoose_1.Schema({
    id: { type: String, required: true },
    type: {
        type: String,
        required: true,
        enum: ["chart", "counter", "table", "heatmap", "log-stream", "alert-list", "gauge", "sparkline"],
    },
    title: { type: String, required: true },
    config: {
        metric: String,
        projectId: String,
        timeRange: String,
        filters: mongoose_1.Schema.Types.Mixed,
        chartType: { type: String, enum: ["line", "bar", "pie", "area"] },
        refreshInterval: Number,
        eventType: {
            type: String,
            enum: ["error", "performance", "web-vital", "network", "interaction", "console", "pageview"],
        },
    },
    layout: {
        x: { type: Number, required: true, default: 0 },
        y: { type: Number, required: true, default: 0 },
        w: { type: Number, required: true, default: 4 },
        h: { type: Number, required: true, default: 3 },
    },
}, { _id: false });
const CustomDashboardSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500 },
    widgets: { type: [DashboardWidgetSchema], default: [] },
    isDefault: { type: Boolean, default: false },
    isShared: { type: Boolean, default: false },
    tags: { type: [String], default: [] },
}, { timestamps: true });
CustomDashboardSchema.index({ userId: 1 });
CustomDashboardSchema.index({ userId: 1, isDefault: 1 });
CustomDashboardSchema.index({ isShared: 1 });
// Ensure only one default dashboard per user
CustomDashboardSchema.pre("save", async function (next) {
    if (this.isDefault && this.isModified("isDefault")) {
        await exports.CustomDashboardModel.updateMany({ userId: this.userId, _id: { $ne: this._id }, isDefault: true }, { $set: { isDefault: false } });
    }
    next();
});
exports.CustomDashboardModel = (0, mongoose_1.model)("CustomDashboard", CustomDashboardSchema);
