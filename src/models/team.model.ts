import mongoose, { Document, Schema, Types } from "mongoose";

export interface ITeamMember {
  user: Types.ObjectId;
  role: "lead" | "member";
}

export interface IProjectAccess {
  project: Types.ObjectId;
  permission: "read" | "write" | "admin";
}

export interface ITeam extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  name: string;
  members: ITeamMember[];
  projectAccess: IProjectAccess[];
  createdAt: Date;
  updatedAt: Date;
}

const TeamMemberSchema = new Schema<ITeamMember>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: {
      type: String,
      enum: ["lead", "member"],
      default: "member",
    },
  },
  { _id: false }
);

const ProjectAccessSchema = new Schema<IProjectAccess>(
  {
    project: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    permission: {
      type: String,
      enum: ["read", "write", "admin"],
      default: "read",
    },
  },
  { _id: false }
);

const TeamSchema = new Schema<ITeam>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    name: { type: String, required: true },
    members: [TeamMemberSchema],
    projectAccess: [ProjectAccessSchema],
  },
  {
    timestamps: true,
  }
);

// Indexes
TeamSchema.index({ organizationId: 1 });
TeamSchema.index({ "members.user": 1 });
TeamSchema.index({ organizationId: 1, name: 1 }, { unique: true });

export const TeamModel = mongoose.model<ITeam>("Team", TeamSchema);
