import { Schema, model, Types, Document, Model } from "mongoose";

export interface IMaintenanceWindow extends Document {
  projectId: Types.ObjectId;
  name: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  reason?: string;
  affectedServices?: string[]; // Optional: only suppress alerts for these services
  affectedEnvironments?: string[]; // Optional: only suppress for these environments
  suppressAllAlerts: boolean; // If true, suppress all alerts regardless of filters
  createdBy: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MaintenanceWindowSchema = new Schema<IMaintenanceWindow>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    description: { type: String },
    startTime: { type: Date, required: true },
    endTime: {
      type: Date,
      required: true,
      validate: {
        validator: function (this: IMaintenanceWindow, value: Date) {
          return value > this.startTime;
        },
        message: "End time must be after start time",
      },
    },
    reason: { type: String },
    affectedServices: { type: [String] },
    affectedEnvironments: { type: [String] },
    suppressAllAlerts: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Compound index for efficient active window queries
MaintenanceWindowSchema.index({ projectId: 1, isActive: 1, startTime: 1, endTime: 1 });
MaintenanceWindowSchema.index({ endTime: 1 }); // For cleanup jobs

// Interface for instance methods
export interface IMaintenanceWindowMethods {
  isCurrentlyActive(): boolean;
}

// Interface for static methods
export interface IMaintenanceWindowModel extends Model<IMaintenanceWindow, {}, IMaintenanceWindowMethods> {
  findActiveWindows(projectId: Types.ObjectId | string): Promise<Array<IMaintenanceWindow & IMaintenanceWindowMethods>>;
}

// Helper method to check if a window is currently active
MaintenanceWindowSchema.methods.isCurrentlyActive = function (): boolean {
  const now = new Date();
  return this.isActive && this.startTime <= now && this.endTime >= now;
};

// Static method to find active windows for a project
MaintenanceWindowSchema.statics.findActiveWindows = function (
  projectId: Types.ObjectId | string
) {
  const now = new Date();
  return this.find({
    projectId: new Types.ObjectId(projectId),
    isActive: true,
    startTime: { $lte: now },
    endTime: { $gte: now },
  });
};

export const MaintenanceWindowModel = model<IMaintenanceWindow, IMaintenanceWindowModel>(
  "MaintenanceWindow",
  MaintenanceWindowSchema
);
