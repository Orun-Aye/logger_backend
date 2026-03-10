import mongoose, { Schema, Document } from 'mongoose';

export interface IReplaySegment extends Document {
  projectId: mongoose.Types.ObjectId;
  sessionId: string;
  segmentIndex: number;
  events: any[];
  startTimestamp: number;
  endTimestamp: number;
  eventCount: number;
  createdAt: Date;
}

const replaySegmentSchema = new Schema<IReplaySegment>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    segmentIndex: { type: Number, required: true, default: 0 },
    events: { type: Schema.Types.Mixed, required: true },
    startTimestamp: { type: Number, required: true },
    endTimestamp: { type: Number, required: true },
    eventCount: { type: Number, required: true },
  },
  { timestamps: true }
);

// Compound index for efficient session segment retrieval
replaySegmentSchema.index({ projectId: 1, sessionId: 1, segmentIndex: 1 });

// TTL index — auto-delete after 7 days
replaySegmentSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

export const ReplaySegmentModel = mongoose.model<IReplaySegment>('ReplaySegment', replaySegmentSchema);
