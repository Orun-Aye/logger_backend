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
exports.UserModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const UserSchema = new mongoose_1.Schema({
    email: { type: String, required: true, unique: true, sparse: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    password: {
        type: String,
        required: function () { return !this.oauthProvider; }
    },
    role: { type: String, enum: ["developer", "admin"], default: "developer" },
    joinedAt: { type: Date, default: Date.now },
    oauthProvider: { type: String },
    oauthId: { type: String, unique: true, sparse: true },
    avatarUrl: { type: String },
    accessToken: { type: String },
    refreshToken: { type: String },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    // MFA fields
    mfaEnabled: { type: Boolean, default: false },
    mfaSecret: { type: String },
    mfaBackupCodes: [{ type: String }],
    // Beta access
    betaAccess: { type: Boolean, default: false },
    betaTier: { type: String, enum: ["core", "full"], default: "core" },
    inviteCode: { type: String },
    githubConnection: {
        type: {
            githubUserId: { type: Number, required: true },
            githubLogin: { type: String, required: true },
            accessToken: { type: String, required: true },
            scopes: { type: [String], default: [] },
            connectedAt: { type: Date, default: Date.now },
        },
        required: false,
        default: undefined,
        select: true,
    },
}, {
    timestamps: true,
});
UserSchema.index({ oauthId: 1, oauthProvider: 1 }, { unique: true, sparse: true });
exports.UserModel = mongoose_1.default.model("User", UserSchema);
