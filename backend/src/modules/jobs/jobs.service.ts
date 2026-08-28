import { env } from "../../config/env";
import { HttpError } from "../../utils/http-error";
import { getJobHandlers } from "./job-handlers";
import { createJobRuntime, type JobRuntime } from "./job-runtime";
import { createJobScheduler, type JobScheduler } from "./job-scheduler";
import { createMongoJobStore } from "./mongo-job-store";
import type { JobId, JobRunRecord } from "./jobs.types";

let runtime: JobRuntime | null = null;
let scheduler: JobScheduler | null = null;

function getRuntime() {
  if (!runtime) {
    runtime = createJobRuntime({
      store: createMongoJobStore(),
      handlers: getJobHandlers(),
      enabled: env.SYNC_SCHEDULER_ENABLED,
      maxConcurrency: env.SYNC_SCHEDULER_MAX_CONCURRENCY,
    });
  }

  return runtime;
}

export function startJobScheduler() {
  if (!env.SYNC_SCHEDULER_ENABLED) {
    console.log("Sync scheduler disabled");
    return;
  }

  const jobRuntime = getRuntime();
  scheduler = createJobScheduler({
    enqueue: (jobId) => jobRuntime.enqueue(jobId, "schedule"),
    startupDelayMs: env.SYNC_SCHEDULER_STARTUP_DELAY_MS,
  });
  scheduler.start();
  console.log(
    `Sync scheduler started (delay ${env.SYNC_SCHEDULER_STARTUP_DELAY_MS}ms, concurrency ${env.SYNC_SCHEDULER_MAX_CONCURRENCY})`,
  );
}

export async function stopJobScheduler() {
  scheduler?.stop();
  scheduler = null;
  if (runtime) {
    await runtime.stop();
  }
}

export function listJobsStatus() {
  return getRuntime().listStatus();
}

export function resultFromJobRun(run: JobRunRecord) {
  if (run.status === "succeeded") {
    return run.result ?? {};
  }

  if (run.status === "skipped") {
    throw new HttpError(run.skipReason || "Sync skipped because credentials are missing", 503);
  }

  if (run.status === "timed_out") {
    throw new HttpError(run.error || "Sync timed out", 504);
  }

  throw new HttpError(run.error || "Sync failed", 500);
}

export async function runManualJob(jobId: JobId, payload?: Record<string, unknown>) {
  const run = await getRuntime().runManual(jobId, payload);
  return resultFromJobRun(run);
}

export type ManualJobOutcome =
  | { status: "succeeded"; result: Record<string, unknown> }
  | { status: "skipped"; skipReason?: string }
  | { status: "failed"; error: string };

export async function runManualJobOutcome(jobId: JobId, payload?: Record<string, unknown>): Promise<ManualJobOutcome> {
  const run = await getRuntime().runManual(jobId, payload);

  if (run.status === "succeeded") {
    return { status: "succeeded", result: run.result ?? {} };
  }

  if (run.status === "skipped") {
    return { status: "skipped", skipReason: run.skipReason };
  }

  return {
    status: "failed",
    error: run.error || (run.status === "timed_out" ? "Sync timed out" : "Sync failed"),
  };
}
