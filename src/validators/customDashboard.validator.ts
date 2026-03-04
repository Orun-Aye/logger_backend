import { z } from "zod";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const widgetLayoutSchema = z.object({
  x: z.number().min(0).default(0),
  y: z.number().min(0).default(0),
  w: z.number().min(1).max(12).default(4),
  h: z.number().min(1).max(12).default(3),
});

const widgetConfigSchema = z.object({
  metric: z.string().optional(),
  projectId: z.string().regex(objectIdRegex).optional(),
  timeRange: z.string().optional(),
  filters: z.record(z.any()).optional(),
  chartType: z.enum(["line", "bar", "pie", "area"]).optional(),
  refreshInterval: z.number().min(5).max(3600).optional(),
});

const widgetSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["chart", "counter", "table", "heatmap", "log-stream", "alert-list"]),
  title: z.string().min(1).max(100),
  config: widgetConfigSchema.optional().default({}),
  layout: widgetLayoutSchema.optional().default({ x: 0, y: 0, w: 4, h: 3 }),
});

export const createDashboardSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim().optional(),
  widgets: z.array(widgetSchema).max(20).optional().default([]),
  isDefault: z.boolean().optional().default(false),
  isShared: z.boolean().optional().default(false),
  tags: z.array(z.string().max(30)).max(10).optional().default([]),
});

export const updateDashboardSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).trim().optional(),
  isDefault: z.boolean().optional(),
  isShared: z.boolean().optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
});

export const updateLayoutSchema = z.object({
  widgets: z.array(widgetSchema).max(20),
});

export const addWidgetSchema = widgetSchema;

export const updateWidgetSchema = z.object({
  type: z.enum(["chart", "counter", "table", "heatmap", "log-stream", "alert-list"]).optional(),
  title: z.string().min(1).max(100).optional(),
  config: widgetConfigSchema.optional(),
  layout: widgetLayoutSchema.optional(),
});

export const dashboardIdParamSchema = z.object({
  dashboardId: z.string().regex(objectIdRegex, "Invalid dashboard ID"),
});

export const widgetIdParamSchema = z.object({
  dashboardId: z.string().regex(objectIdRegex, "Invalid dashboard ID"),
  widgetId: z.string().min(1, "Widget ID is required"),
});

export type CreateDashboardInput = z.infer<typeof createDashboardSchema>;
export type UpdateDashboardInput = z.infer<typeof updateDashboardSchema>;
export type UpdateLayoutInput = z.infer<typeof updateLayoutSchema>;
export type AddWidgetInput = z.infer<typeof addWidgetSchema>;
export type UpdateWidgetInput = z.infer<typeof updateWidgetSchema>;
