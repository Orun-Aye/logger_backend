import mongoose, { Schema, Document } from 'mongoose';

export interface IReplaySegment extends Document {
  projectId: mongoose.Types.ObjectId;
  sessionId: string;
  segmentIndex: number;
  /** Legacy uncompressed events. New segments store eventsGz instead. */
  events?: any[];
  /** Gzipped JSON of the events array */
  eventsGz?: Buffer;
  /** Byte size of the uncompressed events JSON */
  rawBytes?: number;
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
    events: { type: Schema.Types.Mixed },
    eventsGz: { type: Buffer },
    rawBytes: { type: Number },
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

/**
 * Per-session segment counter. ingestSegment claims the next index with an
 * atomic $inc, so concurrent uploads for one session never share an index.
 */
export interface IReplaySessionCounter extends Document {
  projectId: mongoose.Types.ObjectId;
  sessionId: string;
  seq: number;
  updatedAt: Date;
}

const replaySessionCounterSchema = new Schema<IReplaySessionCounter>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    sessionId: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

replaySessionCounterSchema.index({ projectId: 1, sessionId: 1 }, { unique: true });

// Expire with the segments: 7 days after the last upload
replaySessionCounterSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

export const ReplaySessionCounterModel = mongoose.model<IReplaySessionCounter>(
  'ReplaySessionCounter',
  replaySessionCounterSchema
);
