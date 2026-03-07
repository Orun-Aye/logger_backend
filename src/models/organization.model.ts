import mongoose, { Document, Schema, Types } from "mongoose";

export interface IOrganizationMember {
  user: Types.ObjectId;
  role: "owner" | "admin" | "member" | "viewer";
  invitedAt?: Date;
  joinedAt?: Date;
}

export interface IOrganizationSettings {
  defaultRetentionDays: number;
  enforcesMfa: boolean;
}

export interface IOrganization extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  billingEmail?: string;
  plan: "developer" | "starter" | "professional" | "team" | "enterprise";
  ownerId: Types.ObjectId;
  members: IOrganizationMember[];
  settings: IOrganizationSettings;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationMemberSchema = new Schema<IOrganizationMember>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: {
      type: String,
      enum: ["owner", "admin", "member", "viewer"],
      default: "member",
    },
    invitedAt: { type: Date },
    joinedAt: { type: Date },
  },
  { _id: false }
);

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    billingEmail: { type: String },
    plan: {
      type: String,
      enum: ["developer", "starter", "professional", "team", "enterprise"],
      default: "developer",
    },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    members: [OrganizationMemberSchema],
    settings: {
      defaultRetentionDays: { type: Number, default: 7 },
      enforcesMfa: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
OrganizationSchema.index({ slug: 1 }, { unique: true });
OrganizationSchema.index({ ownerId: 1 });
OrganizationSchema.index({ "members.user": 1 });

export const OrganizationModel = mongoose.model<IOrganization>(
  "Organization",
  OrganizationSchema
);
