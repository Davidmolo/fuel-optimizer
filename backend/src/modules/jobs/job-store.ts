import { randomUUID } from "node:crypto";
import type { JobId, JobLockRecord, JobRunRecord, JobTrigger } from "./jobs.types";

const GLOBAL_LOCK_ID = "global";
const ACTIVE_STATUSES = new Set(["queued", "running"]);

export type EnqueueInput = {
  jobId: JobId;
  trigger: JobTrigger;
  priority: number;
  payload?: Record<string, unknown>;
};

export type EnqueueResult = {
  run: JobRunRecord;
  coalesced: boolean;
};

export type DequeueOptions = {
  excludeJobIds?: Iterable<string>;
};

export interface JobStore {
  enqueueIfIdle(input: EnqueueInput): Promise<EnqueueResult>;
  dequeueNext(options?: DequeueOptions): Promise<JobRunRecord | null>;
  markRunning(runId: string, startedAt?: Date): Promise<JobRunRecord | null>;
  markFinished(
    runId: string,
    update: Partial<Pick<JobRunRecord, "status" | "finishedAt" | "durationMs" | "error" | "skipReason" | "result">>,
  ): Promise<JobRunRecord | null>;
  getRun(runId: string): Promise<JobRunRecord | null>;
  getLatestRuns(jobIds: JobId[]): Promise<Map<JobId, JobRunRecord>>;
  getActiveRuns(): Promise<JobRunRecord[]>;
  acquireLock(input: {
    ownerId: string;
    jobId?: JobId;
    runId?: string;
    ttlMs: number;
    now?: Date;
  }): Promise<boolean>;
  releaseLock(ownerId: string): Promise<void>;
}

function cloneRun(run: JobRunRecord): JobRunRecord {
  return {
    ...run,
    queuedAt: new Date(run.queuedAt),
    startedAt: run.startedAt ? new Date(run.startedAt) : undefined,
    finishedAt: run.finishedAt ? new Date(run.finishedAt) : undefined,
    payload: run.payload ? { ...run.payload } : undefined,
    result: run.result ? { ...run.result } : undefined,
  };
}

export function createMemoryJobStore(): JobStore {
  const runs = new Map<string, JobRunRecord>();
  const lock: JobLockRecord = {
    lockId: GLOBAL_LOCK_ID,
    ownerId: null,
    expiresAt: new Date(0),
  };

  function findActive(jobId: JobId) {
    return [...runs.values()].find((run) => run.jobId === jobId && ACTIVE_STATUSES.has(run.status));
  }

  return {
    async enqueueIfIdle(input) {
      const existing = findActive(input.jobId);
      if (existing) {
        return { run: cloneRun(existing), coalesced: true };
      }

      const run: JobRunRecord = {
        id: randomUUID(),
        jobId: input.jobId,
        trigger: input.trigger,
        status: "queued",
        priority: input.priority,
        queuedAt: new Date(),
        payload: input.payload,
      };
      runs.set(run.id, run);
      return { run: cloneRun(run), coalesced: false };
    },

    async dequeueNext(options = {}) {
      const excluded = new Set(options.excludeJobIds ?? []);
      const queued = [...runs.values()]
        .filter((run) => run.status === "queued" && !excluded.has(run.jobId))
        .sort((left, right) => {
          if (right.priority !== left.priority) {
            return right.priority - left.priority;
          }
          return left.queuedAt.getTime() - right.queuedAt.getTime();
        });

      return queued[0] ? cloneRun(queued[0]) : null;
    },

    async markRunning(runId, startedAt = new Date()) {
      const run = runs.get(runId);
      if (!run) {
        return null;
      }
      run.status = "running";
      run.startedAt = startedAt;
      return cloneRun(run);
    },

    async markFinished(runId, update) {
      const run = runs.get(runId);
      if (!run) {
        return null;
      }
      Object.assign(run, update);
      return cloneRun(run);
    },

    async getRun(runId) {
      const run = runs.get(runId);
      return run ? cloneRun(run) : null;
    },

    async getLatestRuns(jobIds) {
      const latest = new Map<JobId, JobRunRecord>();

      for (const run of runs.values()) {
        if (!jobIds.includes(run.jobId)) {
          continue;
        }

        const current = latest.get(run.jobId);
        const runTime = (run.startedAt ?? run.queuedAt).getTime();
        const currentTime = current ? (current.startedAt ?? current.queuedAt).getTime() : -1;
        if (!current || runTime >= currentTime) {
          latest.set(run.jobId, cloneRun(run));
        }
      }

      return latest;
    },

    async getActiveRuns() {
      return [...runs.values()].filter((run) => ACTIVE_STATUSES.has(run.status)).map(cloneRun);
    },

    async acquireLock(input) {
      const now = input.now ?? new Date();
      const expired = !lock.ownerId || lock.expiresAt.getTime() <= now.getTime();
      if (!expired && lock.ownerId !== input.ownerId) {
        return false;
      }

      lock.ownerId = input.ownerId;
      lock.jobId = input.jobId;
      lock.runId = input.runId;
      lock.acquiredAt = now;
      lock.expiresAt = new Date(now.getTime() + input.ttlMs);
      return true;
    },

    async releaseLock(ownerId) {
      if (lock.ownerId === ownerId) {
        lock.ownerId = null;
        lock.jobId = undefined;
        lock.runId = undefined;
        lock.acquiredAt = undefined;
        lock.expiresAt = new Date(0);
      }
    },
  };
}
