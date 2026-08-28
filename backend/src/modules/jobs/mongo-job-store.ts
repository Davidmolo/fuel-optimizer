import type { JobId, JobRunRecord } from "./jobs.types";
import { JobLockModel, GLOBAL_JOB_LOCK_ID } from "./models/job-lock.model";
import { JobRunModel, type JobRunDocument } from "./models/job-run.model";
import type { EnqueueInput, EnqueueResult, JobStore } from "./job-store";

function toRunRecord(document: JobRunDocument & { _id: unknown }): JobRunRecord {
  return {
    id: String(document._id),
    jobId: document.jobId,
    trigger: document.trigger,
    status: document.status,
    priority: document.priority,
    queuedAt: document.queuedAt,
    startedAt: document.startedAt,
    finishedAt: document.finishedAt,
    durationMs: document.durationMs,
    error: document.error,
    skipReason: document.skipReason,
    result: document.result,
    payload: document.payload,
  };
}

function isDuplicateKeyError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === 11000);
}

export function createMongoJobStore(): JobStore {
  return {
    async enqueueIfIdle(input: EnqueueInput): Promise<EnqueueResult> {
      const existing = await JobRunModel.findOne({
        jobId: input.jobId,
        status: { $in: ["queued", "running"] },
      });

      if (existing) {
        return { run: toRunRecord(existing), coalesced: true };
      }

      try {
        const created = await JobRunModel.create({
          jobId: input.jobId,
          trigger: input.trigger,
          status: "queued",
          priority: input.priority,
          queuedAt: new Date(),
          payload: input.payload,
        });
        return { run: toRunRecord(created), coalesced: false };
      } catch (error) {
        if (!isDuplicateKeyError(error)) {
          throw error;
        }

        const raced = await JobRunModel.findOne({
          jobId: input.jobId,
          status: { $in: ["queued", "running"] },
        });

        if (!raced) {
          throw error;
        }

        return { run: toRunRecord(raced), coalesced: true };
      }
    },

    async dequeueNext(options = {}) {
      const excluded = [...(options.excludeJobIds ?? [])];
      const query: Record<string, unknown> = { status: "queued" };

      if (excluded.length > 0) {
        query.jobId = { $nin: excluded };
      }

      const next = await JobRunModel.findOne(query).sort({ priority: -1, queuedAt: 1 });
      return next ? toRunRecord(next) : null;
    },

    async markRunning(runId, startedAt = new Date()) {
      const updated = await JobRunModel.findByIdAndUpdate(
        runId,
        { $set: { status: "running", startedAt } },
        { returnDocument: "after" },
      );
      return updated ? toRunRecord(updated) : null;
    },

    async markFinished(runId, update) {
      const updated = await JobRunModel.findByIdAndUpdate(runId, { $set: update }, { returnDocument: "after" });
      return updated ? toRunRecord(updated) : null;
    },

    async getRun(runId) {
      const run = await JobRunModel.findById(runId);
      return run ? toRunRecord(run) : null;
    },

    async getLatestRuns(jobIds: JobId[]) {
      const latest = new Map<JobId, JobRunRecord>();

      if (jobIds.length === 0) {
        return latest;
      }

      const runs = await JobRunModel.aggregate<{ doc: JobRunDocument & { _id: unknown } }>([
        { $match: { jobId: { $in: jobIds } } },
        { $sort: { queuedAt: -1 } },
        { $group: { _id: "$jobId", doc: { $first: "$$ROOT" } } },
      ]);

      for (const group of runs) {
        const record = toRunRecord(group.doc);
        latest.set(record.jobId, record);
      }

      return latest;
    },

    async getActiveRuns() {
      const runs = await JobRunModel.find({ status: { $in: ["queued", "running"] } });
      return runs.map((run) => toRunRecord(run));
    },

    async acquireLock(input) {
      const now = input.now ?? new Date();
      await JobLockModel.updateOne(
        { _id: GLOBAL_JOB_LOCK_ID },
        { $setOnInsert: { ownerId: null, expiresAt: new Date(0) } },
        { upsert: true },
      );

      const acquired = await JobLockModel.findOneAndUpdate(
        {
          _id: GLOBAL_JOB_LOCK_ID,
          $or: [{ ownerId: null }, { ownerId: input.ownerId }, { expiresAt: { $lte: now } }],
        },
        {
          $set: {
            ownerId: input.ownerId,
            jobId: input.jobId,
            runId: input.runId,
            acquiredAt: now,
            expiresAt: new Date(now.getTime() + input.ttlMs),
          },
        },
        { returnDocument: "after" },
      );

      return Boolean(acquired);
    },

    async releaseLock(ownerId) {
      await JobLockModel.updateOne(
        { _id: GLOBAL_JOB_LOCK_ID, ownerId },
        {
          $set: {
            ownerId: null,
            jobId: null,
            runId: null,
            acquiredAt: null,
            expiresAt: new Date(0),
          },
        },
      );
    },
  };
}
