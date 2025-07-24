import mongoose, { Document, Schema } from "mongoose";

export interface IProject extends Document {
  name: string;
  apiKey: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema: Schema<IProject> = new Schema(
  {
    name: { type: String, required: true },
    apiKey: { type: String, required: true, unique: true },
    description: { type: String },
  },
  {
    timestamps: true,
  }
);

ProjectSchema.index({ apiKey: 1 })

export const Project = mongoose.model<IProject>("Project", ProjectSchema);