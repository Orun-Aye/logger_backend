import mongoose, { Schema, Document } from "mongoose";

export interface ISourceMap extends Document {
  projectId: string;
  release: string;
  fileName: string;
  originalFileName: string;
  sourceMapData: string;
  uploadedBy?: string;
  fileSize: number;
  createdAt: Date;
  updatedAt: Date;
}

const SourceMapSchema = new Schema<ISourceMap>(
  {
    projectId: { type: String, required: true, index: true },
    release: { type: String, required: true },
    fileName: { type: String, required: true },
    originalFileName: { type: String, required: true },
    sourceMapData: { type: String, required: true },
    uploadedBy: { type: String },
    fileSize: { type: Number, required: true },
  },
  { timestamps: true }
);

// Compound index for efficient lookups
SourceMapSchema.index({ projectId: 1, release: 1 });
SourceMapSchema.index(
  { projectId: 1, release: 1, originalFileName: 1 },
  { unique: true }
);

export const SourceMapModel = mongoose.model<ISourceMap>(
  "SourceMap",
  SourceMapSchema
);
