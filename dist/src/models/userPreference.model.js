"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserPreferenceModel = void 0;
const mongoose_1 = require("mongoose");
const UserPreferenceSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    favoriteProjects: [{ type: mongoose_1.Schema.Types.ObjectId, ref: "Project" }],
}, { timestamps: true });
UserPreferenceSchema.index({ userId: 1 }, { unique: true });
exports.UserPreferenceModel = (0, mongoose_1.model)("UserPreference", UserPreferenceSchema);
