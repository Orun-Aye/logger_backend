import mongoose, { Document, Schema, Types } from "mongoose";

export interface ISubscriptionUsage {
  logsIngested: number;
  apiCalls: number;
  lastResetAt: Date;
}

export interface ISubscription extends Document {
  _id: Types.ObjectId;
  organizationId?: Types.ObjectId;
  userId: Types.ObjectId;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  plan: "developer" | "starter" | "professional" | "team" | "enterprise";
  billingCycle: "monthly" | "annual";
  status: "active" | "canceled" | "past_due" | "trialing" | "incomplete";
  usage: ISubscriptionUsage;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionUsageSchema = new Schema<ISubscriptionUsage>(
  {
    logsIngested: { type: Number, default: 0 },
    apiCalls: { type: Number, default: 0 },
    lastResetAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const SubscriptionSchema = new Schema<ISubscription>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },
    userId: {
      type: Schema.Types.ObjectId,
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
  },
  {
    timestamps: true,
  }
);

// Indexes
SubscriptionSchema.index({ userId: 1 }, { unique: true });
SubscriptionSchema.index({ organizationId: 1 });
SubscriptionSchema.index({ stripeCustomerId: 1 });
SubscriptionSchema.index({ stripeSubscriptionId: 1 });
SubscriptionSchema.index({ status: 1 });
SubscriptionSchema.index({ currentPeriodEnd: 1 });

export const SubscriptionModel = mongoose.model<ISubscription>(
  "Subscription",
  SubscriptionSchema
);
