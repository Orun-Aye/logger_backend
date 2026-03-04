import { Document, Schema, Types, model } from "mongoose";

export interface IDashboardWidget {
  id: string;
  type: "chart" | "counter" | "table" | "heatmap" | "log-stream" | "alert-list";
  title: string;
  config: {
    metric?: string;
    projectId?: string;
    timeRange?: string;
    filters?: Record<string, any>;
    chartType?: "line" | "bar" | "pie" | "area";
    refreshInterval?: number;
  };
  layout: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

export interface ICustomDashboard extends Document {
  userId: Types.ObjectId;
  name: string;
  description?: string;
  widgets: IDashboardWidget[];
  isDefault: boolean;
  isShared: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const DashboardWidgetSchema = new Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ["chart", "counter", "table", "heatmap", "log-stream", "alert-list"],
    },
    title: { type: String, required: true },
    config: {
      metric: String,
      projectId: String,
      timeRange: String,
      filters: Schema.Types.Mixed,
      chartType: { type: String, enum: ["line", "bar", "pie", "area"] },
      refreshInterval: Number,
    },
    layout: {
      x: { type: Number, required: true, default: 0 },
      y: { type: Number, required: true, default: 0 },
      w: { type: Number, required: true, default: 4 },
      h: { type: Number, required: true, default: 3 },
    },
  },
  { _id: false }
);

const CustomDashboardSchema = new Schema<ICustomDashboard>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500 },
    widgets: { type: [DashboardWidgetSchema], default: [] },
    isDefault: { type: Boolean, default: false },
    isShared: { type: Boolean, default: false },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);

CustomDashboardSchema.index({ userId: 1 });
CustomDashboardSchema.index({ userId: 1, isDefault: 1 });
CustomDashboardSchema.index({ isShared: 1 });

// Ensure only one default dashboard per user
CustomDashboardSchema.pre("save", async function (next) {
  if (this.isDefault && this.isModified("isDefault")) {
    await CustomDashboardModel.updateMany(
      { userId: this.userId, _id: { $ne: this._id }, isDefault: true },
      { $set: { isDefault: false } }
    );
  }
  next();
});

export const CustomDashboardModel = model<ICustomDashboard>("CustomDashboard", CustomDashboardSchema);
