export const JOB_RUN_STATUSES = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "skipped",
  "timed_out",
] as const;

export type JobRunStatus = (typeof JOB_RUN_STATUSES)[number];

export type JobTrigger = "schedule" | "manual";

export type JobId =
  | "samsara.telemetry"
  | "samsara.registry"
  | "samsara.full"
  | "openroad.loads"
  | "openroad.assignments"
  | "openroad.fleet"
  | "openroad.full"
  | "relay.transactions"
  | "relay.drivers"
  | "relay.full";

export type JobDefinition = {
  id: JobId;
  name: string;
  description: string;
  cron: string | null;
  cadenceLabel: string;
  timeoutMs: number;
  priority: number;
  scheduled: boolean;
};

export type JobHandlerContext = {
  trigger: JobTrigger;
  payload?: Record<string, unknown>;
};

export type JobHandler = (context: JobHandlerContext) => Promise<Record<string, unknown>>;

export type JobRunRecord = {
  id: string;
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
};

export type JobLockRecord = {
  lockId: string;
  ownerId: string | null;
  jobId?: JobId;
  runId?: string;
  acquiredAt?: Date;
  expiresAt: Date;
};

export type JobStatusView = {
  id: JobId;
  name: string;
  description: string;
  cadenceLabel: string;
  cron: string | null;
  timeoutMs: number;
  priority: number;
  scheduled: boolean;
  queueStatus: "idle" | "queued" | "running";
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

export type JobsStatusView = {
  enabled: boolean;
  maxConcurrency: number;
  running: {
    jobId: JobId;
    runId: string;
    startedAt?: string;
  } | null;
  jobs: JobStatusView[];
};
