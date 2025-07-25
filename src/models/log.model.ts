import mongoose, { Document, Schema } from "mongoose";


export interface ILog extends Document {
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  message: string;
  projectId: mongoose.Types.ObjectId;
  source: string;
  metadata?: Record<string, any>;
  timestamp: Date
}

const LogSchema: Schema<ILog> = new Schema(
  {
    level: { type: String, enum: ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'], required: true },
    message: { type: String, required: true },
    
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    source: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  }
);


export const LogModel = mongoose.model<ILog>("Log", LogSchema);