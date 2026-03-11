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
exports.SubscriptionModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const SubscriptionUsageSchema = new mongoose_1.Schema({
    logsIngested: { type: Number, default: 0 },
    apiCalls: { type: Number, default: 0 },
    lastResetAt: { type: Date, default: Date.now },
}, { _id: false });
const SubscriptionSchema = new mongoose_1.Schema({
    organizationId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Organization",
        default: null,
    },
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    stripeCustomerId: { type: String, default: null },
    stripeSubscriptionId: { type: String, default: null },
    plan: {
        type: String,
        enum: ["developer", "starter", "professional", "team", "enterprise"],
        default: "developer",
    },
    billingCycle: {
        type: String,
        enum: ["monthly", "annual"],
        default: "monthly",
    },
    status: {
        type: String,
        enum: ["active", "canceled", "past_due", "trialing", "incomplete"],
        default: "active",
    },
    usage: {
        type: SubscriptionUsageSchema,
        default: () => ({
            logsIngested: 0,
            apiCalls: 0,
            lastResetAt: new Date(),
        }),
    },
    currentPeriodStart: { type: Date, default: Date.now },
    currentPeriodEnd: {
        type: Date,
        default: () => {
            const d = new Date();
            d.setMonth(d.getMonth() + 1);
            return d;
        },
    },
    cancelAt: { type: Date, default: null },
}, {
    timestamps: true,
});
// Indexes
SubscriptionSchema.index({ userId: 1 }, { unique: true });
SubscriptionSchema.index({ organizationId: 1 });
SubscriptionSchema.index({ stripeCustomerId: 1 });
SubscriptionSchema.index({ stripeSubscriptionId: 1 });
SubscriptionSchema.index({ status: 1 });
SubscriptionSchema.index({ currentPeriodEnd: 1 });
exports.SubscriptionModel = mongoose_1.default.model("Subscription", SubscriptionSchema);
