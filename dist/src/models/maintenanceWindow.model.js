"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaintenanceWindowModel = void 0;
const mongoose_1 = require("mongoose");
const MaintenanceWindowSchema = new mongoose_1.Schema({
    projectId: {
        type: mongoose_1.Schema.Types.ObjectId,
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
            validator: function (value) {
                return value > this.startTime;
            },
            message: "End time must be after start time",
        },
    },
    reason: { type: String },
    affectedServices: { type: [String] },
    affectedEnvironments: { type: [String] },
    suppressAllAlerts: { type: Boolean, default: true },
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });
// Compound index for efficient active window queries
MaintenanceWindowSchema.index({ projectId: 1, isActive: 1, startTime: 1, endTime: 1 });
MaintenanceWindowSchema.index({ endTime: 1 }); // For cleanup jobs
// Helper method to check if a window is currently active
MaintenanceWindowSchema.methods.isCurrentlyActive = function () {
    const now = new Date();
    return this.isActive && this.startTime <= now && this.endTime >= now;
};
// Static method to find active windows for a project
MaintenanceWindowSchema.statics.findActiveWindows = function (projectId) {
    const now = new Date();
    return this.find({
        projectId: new mongoose_1.Types.ObjectId(projectId),
        isActive: true,
        startTime: { $lte: now },
        endTime: { $gte: now },
    });
};
exports.MaintenanceWindowModel = (0, mongoose_1.model)("MaintenanceWindow", MaintenanceWindowSchema);
