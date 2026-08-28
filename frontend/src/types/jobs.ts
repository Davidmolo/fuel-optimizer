export type JobRunStatus = "queued" | "running" | "succeeded" | "failed" | "skipped" | "timed_out";
export type JobTrigger = "schedule" | "manual";
export type JobQueueStatus = "idle" | "queued" | "running";

export type JobStatus = {
  id: string;
  name: string;
  description: string;
  cadenceLabel: string;
  cron: string | null;
  timeoutMs: number;
  priority: number;
  scheduled: boolean;
  queueStatus: JobQueueStatus;
  nextRunAt: string | null;
  lastRun: {
    id: string;
    status: JobRunStatus;
    trigger: JobTrigger;
    queuedAt: string;
    startedAt?: string;
    finishedAt?: string;
    durationMs?: number;
    error?: string;
    skipReason?: string;
  } | null;
};

export type JobsStatusResponse = {
  enabled: boolean;
  maxConcurrency: number;
  running: {
    jobId: string;
    runId: string;
    startedAt?: string;
  } | null;
  jobs: JobStatus[];
};
