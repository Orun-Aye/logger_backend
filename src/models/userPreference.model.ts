import { Document, Schema, Types, model } from "mongoose";

export interface IUserPreference extends Document {
  userId: Types.ObjectId;
  favoriteProjects: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const UserPreferenceSchema = new Schema<IUserPreference>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    favoriteProjects: [{ type: Schema.Types.ObjectId, ref: "Project" }],
  },
  { timestamps: true }
);

UserPreferenceSchema.index({ userId: 1 }, { unique: true });

export const UserPreferenceModel = model<IUserPreference>("UserPreference", UserPreferenceSchema);
