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
exports.WaitlistModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const WaitlistSchema = new mongoose_1.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    position: { type: Number, required: true },
    referralCode: { type: String, required: true, unique: true },
    status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
    },
    inviteCode: { type: String, default: null, unique: true, sparse: true },
    approvedAt: { type: Date, default: null },
    invitedAt: { type: Date, default: null },
    signedUpAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
});
WaitlistSchema.index({ email: 1 }, { unique: true });
WaitlistSchema.index({ position: 1 });
WaitlistSchema.index({ status: 1 });
WaitlistSchema.index({ inviteCode: 1 }, { unique: true, sparse: true });
exports.WaitlistModel = mongoose_1.default.model("WaitlistEntry", WaitlistSchema);
