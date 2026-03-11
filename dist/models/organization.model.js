"use strict";
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
exports.OrganizationModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const OrganizationMemberSchema = new mongoose_1.Schema({
    user: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    role: {
        type: String,
        enum: ["owner", "admin", "member", "viewer"],
        default: "member",
    },
    invitedAt: { type: Date },
    joinedAt: { type: Date },
}, { _id: false });
const OrganizationSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    billingEmail: { type: String },
    plan: {
        type: String,
        enum: ["developer", "starter", "professional", "team", "enterprise"],
        default: "developer",
    },
    ownerId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    members: [OrganizationMemberSchema],
    settings: {
        defaultRetentionDays: { type: Number, default: 7 },
        enforcesMfa: { type: Boolean, default: false },
    },
}, {
    timestamps: true,
});
// Indexes
OrganizationSchema.index({ slug: 1 }, { unique: true });
OrganizationSchema.index({ ownerId: 1 });
OrganizationSchema.index({ "members.user": 1 });
exports.OrganizationModel = mongoose_1.default.model("Organization", OrganizationSchema);
