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
exports.WebhookDeliveryModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const WebhookDeliverySchema = new mongoose_1.Schema({
    provider: {
        type: String,
        enum: ["github"],
        required: true,
    },
    deliveryId: {
        type: String,
        required: true,
    },
    event: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ["processing", "processed", "failed", "skipped"],
        default: "processing",
    },
    error: {
        type: String,
    },
    receivedAt: {
        type: Date,
        default: Date.now,
    },
});
WebhookDeliverySchema.index({ provider: 1, deliveryId: 1 }, { unique: true });
// Auto-expire delivery records after 7 days
WebhookDeliverySchema.index({ receivedAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });
exports.WebhookDeliveryModel = mongoose_1.default.model("WebhookDelivery", WebhookDeliverySchema);
