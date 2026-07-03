import mongoose, { Schema, Document } from "mongoose";

/**
 * Idempotency record for inbound webhook deliveries. GitHub retries
 * deliveries, and a unique index on deliveryId makes reprocessing safe
 * across restarts and multiple instances.
 */
export interface IWebhookDelivery extends Document {
  provider: "github";
  deliveryId: string;
  event: string;
  status: "processing" | "processed" | "failed" | "skipped";
  error?: string;
  receivedAt: Date;
}

const WebhookDeliverySchema: Schema = new Schema<IWebhookDelivery>({
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
WebhookDeliverySchema.index(
  { receivedAt: 1 },
  { expireAfterSeconds: 7 * 24 * 60 * 60 }
);

export const WebhookDeliveryModel = mongoose.model<IWebhookDelivery>(
  "WebhookDelivery",
  WebhookDeliverySchema
);
