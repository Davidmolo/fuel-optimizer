import { model, Schema } from "mongoose";
import type { JobId, JobRunStatus, JobTrigger } from "../jobs.types";

export type JobRunDocument = {
  jobId: JobId;
  trigger: JobTrigger;
  status: JobRunStatus;
  priority: number;
  queuedAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
  durationMs?: number;
  error?: string;
  skipReason?: string;
  result?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

const jobRunSchema = new Schema<JobRunDocument>(
  {
    jobId: { type: String, required: true },
    trigger: { type: String, required: true, enum: ["schedule", "manual"] },
    status: {
      type: String,
      required: true,
      enum: ["queued", "running", "succeeded", "failed", "skipped", "timed_out"],
      index: true,
    },
    priority: { type: Number, required: true },
    queuedAt: { type: Date, required: true },
    startedAt: { type: Date },
    finishedAt: { type: Date },
    durationMs: { type: Number },
    error: { type: String },
    skipReason: { type: String },
    result: { type: Schema.Types.Mixed },
    payload: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

jobRunSchema.index({ status: 1, priority: -1, queuedAt: 1 });
jobRunSchema.index(
  { jobId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ["queued", "running"] } } },
);

export const JobRunModel = model<JobRunDocument>("JobRun", jobRunSchema);
