import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { getNextCronDate } from "./cron";
import { JOB_DEFINITIONS, getJobDefinition } from "./job.registry";
import type { JobStore } from "./job-store";
import type { JobDefinition, JobHandler, JobId, JobRunRecord, JobTrigger, JobsStatusView } from "./jobs.types";
import { JobTimeoutError, SkipJobError } from "./skip-job-error";

const TERMINAL_STATUSES = new Set(["succeeded", "failed", "skipped", "timed_out"]);

export type JobRuntimeOptions = {
  store: JobStore;
  handlers: Partial<Record<JobId, JobHandler>>;
  enabled?: boolean;
  maxConcurrency?: number;
  now?: () => Date;
  waitPollMs?: number;
  getDefinition?: (jobId: string) => JobDefinition | undefined;
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new JobTimeoutError(timeoutMs));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) {
      clearTimeout(timer);
    }
  });
}

export function createJobRuntime(options: JobRuntimeOptions) {
  const store = options.store;
  const enabled = options.enabled ?? true;
  const maxConcurrency = Math.max(1, options.maxConcurrency ?? 1);
  const now = options.now ?? (() => new Date());
  const waitPollMs = options.waitPollMs ?? 100;
  const resolveDefinition = options.getDefinition ?? getJobDefinition;
  const events = new EventEmitter();
  events.setMaxListeners(50);

  const inflight = new Map<JobId, Promise<unknown>>();
  const ownerId = `${process.pid}:${randomUUID()}`;
  let activeSlots = 0;
  let stopping = false;

  function emitRun(run: JobRunRecord) {
    events.emit("run", run);
  }

  async function enqueue(jobId: JobId, trigger: JobTrigger, payload?: Record<string, unknown>) {
    const definition = resolveDefinition(jobId);
    if (!definition) {
      throw new Error(`Unknown job "${jobId}"`);
    }

    const result = await store.enqueueIfIdle({
      jobId,
      trigger,
      priority: definition.priority,
      payload,
    });

    void pump();
    return result;
  }

  async function waitForRun(runId: string, timeoutMs: number) {
    const existing = await store.getRun(runId);
    if (existing && TERMINAL_STATUSES.has(existing.status)) {
      return existing;
    }

    return new Promise<JobRunRecord>((resolve, reject) => {
      const onRun = (run: JobRunRecord) => {
        if (run.id === runId && TERMINAL_STATUSES.has(run.status)) {
          cleanup();
          resolve(run);
        }
      };

      const timer = setTimeout(() => {
        cleanup();
        void store.getRun(runId).then((run) => {
          if (run && TERMINAL_STATUSES.has(run.status)) {
            resolve(run);
            return;
          }
          reject(new Error(`Timed out waiting for job run ${runId}`));
        }, reject);
      }, timeoutMs);

      const poll = setInterval(() => {
        void store.getRun(runId).then((run) => {
          if (run && TERMINAL_STATUSES.has(run.status)) {
            cleanup();
            resolve(run);
          }
        });
      }, waitPollMs);

      function cleanup() {
        clearTimeout(timer);
        clearInterval(poll);
        events.off("run", onRun);
      }

      events.on("run", onRun);
    });
  }

  async function executeRun(run: JobRunRecord) {
    const definition = resolveDefinition(run.jobId);
    if (!definition) {
      const finished = await store.markFinished(run.id, {
        status: "failed",
        error: `Unknown job "${run.jobId}"`,
        finishedAt: now(),
        durationMs: 0,
      });
      if (finished) {
        emitRun(finished);
      }
      return;
    }

    const handler = options.handlers[run.jobId];
    if (!handler) {
      const finished = await store.markFinished(run.id, {
        status: "failed",
        error: `No handler registered for "${run.jobId}"`,
        finishedAt: now(),
        durationMs: 0,
      });
      if (finished) {
        emitRun(finished);
      }
      return;
    }

    const started = await store.markRunning(run.id, now());
    if (started) {
      emitRun(started);
    }

    const startedAt = started?.startedAt ?? now();
    const work = handler({ trigger: run.trigger, payload: run.payload });
    inflight.set(
      run.jobId,
      work.finally(() => {
        inflight.delete(run.jobId);
      }),
    );

    try {
      const result = await withTimeout(work, definition.timeoutMs);
      const finishedAt = now();
      const finished = await store.markFinished(run.id, {
        status: "succeeded",
        result,
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
      });
      if (finished) {
        emitRun(finished);
      }
    } catch (error) {
      const finishedAt = now();
      const durationMs = finishedAt.getTime() - startedAt.getTime();

      if (error instanceof SkipJobError) {
        console.warn(`Job ${run.jobId} skipped: ${error.reason}`);
        const finished = await store.markFinished(run.id, {
          status: "skipped",
          skipReason: error.reason,
          finishedAt,
          durationMs,
        });
        if (finished) {
          emitRun(finished);
        }
        return;
      }

      if (error instanceof JobTimeoutError) {
        const finished = await store.markFinished(run.id, {
          status: "timed_out",
          error: error.message,
          finishedAt,
          durationMs,
        });
        if (finished) {
          emitRun(finished);
        }
        void work.catch(() => undefined);
        return;
      }

      const message = error instanceof Error ? error.message : "Unknown job error";
      const finished = await store.markFinished(run.id, {
        status: "failed",
        error: message,
        finishedAt,
        durationMs,
      });
      if (finished) {
        emitRun(finished);
      }
    }
  }

  async function pump() {
    if (stopping || activeSlots >= maxConcurrency) {
      return;
    }

    activeSlots += 1;

    try {
      while (!stopping) {
        const acquired = await store.acquireLock({
          ownerId,
          ttlMs: 30_000,
          now: now(),
        });

        if (!acquired) {
          return;
        }

        try {
          const next = await store.dequeueNext({ excludeJobIds: inflight.keys() });
          if (!next) {
            return;
          }

          const definition = resolveDefinition(next.jobId);
          await store.acquireLock({
            ownerId,
            jobId: next.jobId,
            runId: next.id,
            ttlMs: (definition?.timeoutMs ?? 30_000) + 15_000,
            now: now(),
          });

          await executeRun(next);
        } finally {
          await store.releaseLock(ownerId);
        }
      }
    } finally {
      activeSlots -= 1;
      if (!stopping) {
        const remaining = await store.dequeueNext({ excludeJobIds: inflight.keys() });
        if (remaining) {
          void pump();
        }
      }
    }
  }

  async function runManual(jobId: JobId, payload?: Record<string, unknown>) {
    const definition = resolveDefinition(jobId);
    if (!definition) {
      throw new Error(`Unknown job "${jobId}"`);
    }

    const { run } = await enqueue(jobId, "manual", payload);
    return waitForRun(run.id, definition.timeoutMs + 6 * 60_000);
  }

  async function listStatus(): Promise<JobsStatusView> {
    const jobIds = JOB_DEFINITIONS.map((job) => job.id);
    const [latest, active] = await Promise.all([store.getLatestRuns(jobIds), store.getActiveRuns()]);
    const running = active.find((run) => run.status === "running") ?? null;
    const current = now();

    return {
      enabled,
      maxConcurrency,
      running: running
        ? {
            jobId: running.jobId,
            runId: running.id,
            startedAt: running.startedAt?.toISOString(),
          }
        : null,
      jobs: JOB_DEFINITIONS.map((job) => {
        const lastRun = latest.get(job.id) ?? null;
        const activeForJob = active.find((run) => run.jobId === job.id);

        return {
          id: job.id,
          name: job.name,
          description: job.description,
          cadenceLabel: job.cadenceLabel,
          cron: job.cron,
          timeoutMs: job.timeoutMs,
          priority: job.priority,
          scheduled: job.scheduled,
          queueStatus: activeForJob?.status === "running" ? "running" : activeForJob ? "queued" : "idle",
          nextRunAt: job.cron ? getNextCronDate(job.cron, current).toISOString() : null,
          lastRun: lastRun
            ? {
                id: lastRun.id,
                status: lastRun.status,
                trigger: lastRun.trigger,
                queuedAt: lastRun.queuedAt.toISOString(),
                startedAt: lastRun.startedAt?.toISOString(),
                finishedAt: lastRun.finishedAt?.toISOString(),
                durationMs: lastRun.durationMs,
                error: lastRun.error,
                skipReason: lastRun.skipReason,
              }
            : null,
        };
      }),
    };
  }

  async function stop(timeoutMs = 15_000) {
    stopping = true;
    const outstanding = [...inflight.values()];
    if (outstanding.length === 0) {
      await store.releaseLock(ownerId);
      return;
    }

    await Promise.race([
      Promise.allSettled(outstanding),
      new Promise((resolve) => {
        setTimeout(resolve, timeoutMs);
      }),
    ]);
    await store.releaseLock(ownerId);
  }

  return {
    enqueue,
    runManual,
    pump,
    waitForRun,
    listStatus,
    stop,
    events,
    inflight,
  };
}

export type JobRuntime = ReturnType<typeof createJobRuntime>;
