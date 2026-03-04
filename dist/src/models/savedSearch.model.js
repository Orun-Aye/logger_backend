"use strict";
// src/models/savedSearch.model.ts
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
exports.SavedSearchModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const savedSearchSchema = new mongoose_1.Schema({
    projectId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Project",
        required: true,
        index: true,
    },
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
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
        customFilters: { type: mongoose_1.Schema.Types.Mixed },
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
}, {
    timestamps: true,
    collection: "savedsearches",
});
// Indexes for efficient queries
savedSearchSchema.index({ projectId: 1, userId: 1 });
savedSearchSchema.index({ projectId: 1, isShared: 1 });
savedSearchSchema.index({ userId: 1, isDefault: 1 });
// Ensure only one default search per user per project
savedSearchSchema.pre("save", async function (next) {
    if (this.isDefault && this.isModified("isDefault")) {
        // Unset other default searches for this user and project
        await exports.SavedSearchModel.updateMany({
            projectId: this.projectId,
            userId: this.userId,
            _id: { $ne: this._id },
        }, { isDefault: false });
    }
    next();
});
exports.SavedSearchModel = mongoose_1.default.model("SavedSearch", savedSearchSchema);
