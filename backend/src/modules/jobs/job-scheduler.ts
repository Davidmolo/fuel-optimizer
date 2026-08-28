import { matchesCron, truncateToUtcMinute } from "./cron";
import { getScheduledJobDefinitions } from "./job.registry";
import type { JobId } from "./jobs.types";

export type JobSchedulerOptions = {
  enqueue: (jobId: JobId, trigger: "schedule") => Promise<unknown>;
  now?: () => Date;
  startupDelayMs: number;
  intervalMs?: number;
};

function minuteKey(date: Date) {
  return truncateToUtcMinute(date).toISOString();
}

export function createJobScheduler(options: JobSchedulerOptions) {
  const intervalMs = options.intervalMs ?? 60_000;
  const processedMinutes = new Set<string>();
  let readyAt: Date | null = null;
  let delayTimer: ReturnType<typeof setTimeout> | undefined;
  let intervalTimer: ReturnType<typeof setInterval> | undefined;

  async function tick(current = options.now?.() ?? new Date()) {
    const enqueued: JobId[] = [];

    if (!readyAt) {
      return { enqueued };
    }

    if (truncateToUtcMinute(current).getTime() <= truncateToUtcMinute(readyAt).getTime()) {
      return { enqueued };
    }

    const key = minuteKey(current);
    if (processedMinutes.has(key)) {
      return { enqueued };
    }

    processedMinutes.add(key);
    if (processedMinutes.size > 12) {
      const oldest = processedMinutes.values().next().value;
      if (oldest) {
        processedMinutes.delete(oldest);
      }
    }

    for (const job of getScheduledJobDefinitions()) {
      if (!job.cron || !matchesCron(job.cron, current)) {
        continue;
      }

      await options.enqueue(job.id, "schedule");
      enqueued.push(job.id);
    }

    return { enqueued };
  }

  function markReady(at = options.now?.() ?? new Date()) {
    readyAt = at;
  }

  function start() {
    if (delayTimer || intervalTimer) {
      return;
    }

    delayTimer = setTimeout(() => {
      markReady(options.now?.() ?? new Date());
      void tick().catch((error) => {
        console.error("Sync scheduler tick failed", error);
      });
      intervalTimer = setInterval(() => {
        void tick().catch((error) => {
          console.error("Sync scheduler tick failed", error);
        });
      }, intervalMs);
    }, options.startupDelayMs);
  }

  function stop() {
    if (delayTimer) {
      clearTimeout(delayTimer);
      delayTimer = undefined;
    }

    if (intervalTimer) {
      clearInterval(intervalTimer);
      intervalTimer = undefined;
    }
  }

  return {
    start,
    stop,
    tick,
    markReady,
    getReadyAt: () => readyAt,
  };
}

export type JobScheduler = ReturnType<typeof createJobScheduler>;
