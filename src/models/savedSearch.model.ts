// src/models/savedSearch.model.ts

import mongoose, { Schema, Document, Types } from "mongoose";

export interface ISavedSearch extends Document {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  description?: string;
  filters: {
    levels?: string[]; // Log levels filter
    services?: string[]; // Service names filter
    environments?: string[]; // Environment filter
    eventTypes?: string[]; // Event type filter
    search?: string; // Full-text search query
    timeRange?: {
      start?: Date;
      end?: Date;
      preset?: string; // "1h", "24h", "7d", "30d"
    };
    customFilters?: Record<string, any>; // Additional custom filters
  };
  isDefault: boolean; // Auto-load this search on page load
  isShared: boolean; // Shared with team members
  sortBy?: string; // Sort field
  sortOrder?: "asc" | "desc";
  createdAt: Date;
  updatedAt: Date;
}

const savedSearchSchema = new Schema<ISavedSearch>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    filters: {
      levels: [{ type: String }],
      services: [{ type: String }],
      environments: [{ type: String }],
      eventTypes: [{ type: String }],
      search: { type: String },
      timeRange: {
        start: { type: Date },
        end: { type: Date },
        preset: { type: String },
      },
      customFilters: { type: Schema.Types.Mixed },
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    isShared: {
      type: Boolean,
      default: false,
    },
    sortBy: {
      type: String,
      default: "timestamp",
    },
    sortOrder: {
      type: String,
      enum: ["asc", "desc"],
      default: "desc",
    },
  },
  {
    timestamps: true,
    collection: "savedsearches",
  }
);

// Indexes for efficient queries
savedSearchSchema.index({ projectId: 1, userId: 1 });
savedSearchSchema.index({ projectId: 1, isShared: 1 });
savedSearchSchema.index({ userId: 1, isDefault: 1 });

// Ensure only one default search per user per project
savedSearchSchema.pre("save", async function (next) {
  if (this.isDefault && this.isModified("isDefault")) {
    // Unset other default searches for this user and project
    await SavedSearchModel.updateMany(
      {
        projectId: this.projectId,
        userId: this.userId,
        _id: { $ne: this._id },
      },
      { isDefault: false }
    );
  }
  next();
});

export const SavedSearchModel = mongoose.model<ISavedSearch>(
  "SavedSearch",
  savedSearchSchema
);
