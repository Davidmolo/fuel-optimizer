import { model, Schema } from "mongoose";
import type { JobId } from "../jobs.types";

export const GLOBAL_JOB_LOCK_ID = "global";

export type JobLockDocument = {
  _id: string;
  ownerId: string | null;
  jobId?: JobId;
  runId?: string;
  acquiredAt?: Date;
  expiresAt: Date;
};

const jobLockSchema = new Schema<JobLockDocument>({
  _id: { type: String, required: true },
  ownerId: { type: String, default: null },
  jobId: { type: String },
  runId: { type: String },
  acquiredAt: { type: Date },
  expiresAt: { type: Date, required: true },
});

export const JobLockModel = model<JobLockDocument>("JobLock", jobLockSchema);
