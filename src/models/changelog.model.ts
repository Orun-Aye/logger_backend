import mongoose, { Schema, Document } from "mongoose";

export interface IChangelog extends Document {
  version: string;
  title: string;
  date: Date;
  category: "feature" | "improvement" | "bugfix" | "security" | "performance";
  description: string;
  highlights: string[];
  author?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ChangelogSchema: Schema = new Schema<IChangelog>(
  {
    version: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    category: {
      type: String,
      required: true,
      enum: ["feature", "improvement", "bugfix", "security", "performance"],
      index: true,
    },
    description: {
      type: String,
      required: true,
    },
    highlights: {
      type: [String],
      default: [],
    },
    author: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

ChangelogSchema.index({ date: -1 });
ChangelogSchema.index({ version: 1 });

export const ChangelogModel = mongoose.model<IChangelog>(
  "Changelog",
  ChangelogSchema
);
