"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.widgetIdParamSchema = exports.dashboardIdParamSchema = exports.updateWidgetSchema = exports.addWidgetSchema = exports.updateLayoutSchema = exports.updateDashboardSchema = exports.createDashboardSchema = void 0;
const zod_1 = require("zod");
const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const widgetLayoutSchema = zod_1.z.object({
    x: zod_1.z.number().min(0).default(0),
    y: zod_1.z.number().min(0).default(0),
    w: zod_1.z.number().min(1).max(12).default(4),
    h: zod_1.z.number().min(1).max(12).default(3),
});
const widgetConfigSchema = zod_1.z.object({
    metric: zod_1.z.string().optional(),
    projectId: zod_1.z.string().regex(objectIdRegex).optional(),
    timeRange: zod_1.z.string().optional(),
    filters: zod_1.z.record(zod_1.z.any()).optional(),
    chartType: zod_1.z.enum(["line", "bar", "pie", "area"]).optional(),
    refreshInterval: zod_1.z.number().min(5).max(3600).optional(),
});
const widgetSchema = zod_1.z.object({
    id: zod_1.z.string().optional(),
    type: zod_1.z.enum(["chart", "counter", "table", "heatmap", "log-stream", "alert-list"]),
    title: zod_1.z.string().min(1).max(100),
    config: widgetConfigSchema.optional().default({}),
    layout: widgetLayoutSchema.optional().default({ x: 0, y: 0, w: 4, h: 3 }),
});
exports.createDashboardSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).trim(),
    description: zod_1.z.string().max(500).trim().optional(),
    widgets: zod_1.z.array(widgetSchema).max(20).optional().default([]),
    isDefault: zod_1.z.boolean().optional().default(false),
    isShared: zod_1.z.boolean().optional().default(false),
    tags: zod_1.z.array(zod_1.z.string().max(30)).max(10).optional().default([]),
});
exports.updateDashboardSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).trim().optional(),
    description: zod_1.z.string().max(500).trim().optional(),
    isDefault: zod_1.z.boolean().optional(),
    isShared: zod_1.z.boolean().optional(),
    tags: zod_1.z.array(zod_1.z.string().max(30)).max(10).optional(),
});
exports.updateLayoutSchema = zod_1.z.object({
    widgets: zod_1.z.array(widgetSchema).max(20),
});
exports.addWidgetSchema = widgetSchema;
exports.updateWidgetSchema = zod_1.z.object({
    type: zod_1.z.enum(["chart", "counter", "table", "heatmap", "log-stream", "alert-list"]).optional(),
    title: zod_1.z.string().min(1).max(100).optional(),
    config: widgetConfigSchema.optional(),
    layout: widgetLayoutSchema.optional(),
});
exports.dashboardIdParamSchema = zod_1.z.object({
    dashboardId: zod_1.z.string().regex(objectIdRegex, "Invalid dashboard ID"),
});
exports.widgetIdParamSchema = zod_1.z.object({
    dashboardId: zod_1.z.string().regex(objectIdRegex, "Invalid dashboard ID"),
    widgetId: zod_1.z.string().min(1, "Widget ID is required"),
});
