import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getNextCronDate, matchesCron } from "./cron";
import { getJobDefinition } from "./job.registry";
import { createJobRuntime } from "./job-runtime";
import { createJobScheduler } from "./job-scheduler";
import { createMemoryJobStore } from "./job-store";
import type { JobId } from "./jobs.types";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitUntil(predicate: () => boolean | Promise<boolean>, timeoutMs = 1000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await predicate()) {
      return;
    }
    await sleep(10);
  }
  throw new Error("Timed out waiting for condition");
}

describe("cron", () => {
  it("matches staggered telemetry and load minutes", () => {
    const telemetry = new Date("2026-08-28T12:05:00.000Z");
    const loads = new Date("2026-08-28T12:12:00.000Z");
    const assignments = new Date("2026-08-28T12:22:00.000Z");

    assert.equal(matchesCron("*/5 * * * *", telemetry), true);
    assert.equal(matchesCron("2,12,22,32,42,52 * * * *", loads), true);
    assert.equal(matchesCron("7,22,37,52 * * * *", assignments), true);
    assert.equal(matchesCron("*/5 * * * *", loads), false);
  });

  it("computes the next 5-minute telemetry slot", () => {
    const next = getNextCronDate("*/5 * * * *", new Date("2026-08-28T12:01:00.000Z"));
    assert.equal(next.toISOString(), "2026-08-28T12:05:00.000Z");
  });
});

describe("job store", () => {
  it("coalesces a second enqueue while a job is queued or running", async () => {
    const store = createMemoryJobStore();
    const first = await store.enqueueIfIdle({
      jobId: "samsara.telemetry",
      trigger: "schedule",
      priority: 100,
    });
    const second = await store.enqueueIfIdle({
      jobId: "samsara.telemetry",
      trigger: "manual",
      priority: 100,
    });

    assert.equal(first.coalesced, false);
    assert.equal(second.coalesced, true);
    assert.equal(second.run.id, first.run.id);
    assert.equal((await store.getActiveRuns()).length, 1);
  });

  it("dequeues the highest-priority job first", async () => {
    const store = createMemoryJobStore();
    await store.enqueueIfIdle({ jobId: "relay.drivers", trigger: "schedule", priority: 20 });
    await store.enqueueIfIdle({ jobId: "samsara.telemetry", trigger: "schedule", priority: 100 });
    await store.enqueueIfIdle({ jobId: "openroad.loads", trigger: "schedule", priority: 90 });

    const next = await store.dequeueNext();
    assert.equal(next?.jobId, "samsara.telemetry");
  });

  it("releases an expired lock so another owner can acquire it", async () => {
    const store = createMemoryJobStore();
    const now = new Date("2026-08-28T12:00:00.000Z");

    assert.equal(await store.acquireLock({ ownerId: "a", ttlMs: 1000, now }), true);
    assert.equal(await store.acquireLock({ ownerId: "b", ttlMs: 1000, now }), false);

    const later = new Date(now.getTime() + 2000);
    assert.equal(await store.acquireLock({ ownerId: "b", ttlMs: 1000, now: later }), true);
  });
});

describe("job runtime", () => {
  it("runs one job at a time and starts the next only after the lock is free", async () => {
    const store = createMemoryJobStore();
    const order: string[] = [];
    const firstGate = deferred<Record<string, unknown>>();
    const firstStarted = deferred<void>();

    const runtime = createJobRuntime({
      store,
      waitPollMs: 10,
      handlers: {
        async "samsara.telemetry"() {
          firstStarted.resolve();
          order.push("telemetry-start");
          return firstGate.promise;
        },
        async "openroad.loads"() {
          order.push("loads");
          return { ok: true };
        },
      },
    });

    await runtime.enqueue("samsara.telemetry", "schedule");
    await firstStarted.promise;
    await runtime.enqueue("openroad.loads", "schedule");
    await sleep(40);

    assert.deepEqual(order, ["telemetry-start"]);
    firstGate.resolve({ ok: true });

    await waitUntil(() => order.includes("loads"));
    assert.deepEqual(order, ["telemetry-start", "loads"]);
    await runtime.stop();
  });

  it("marks a hung job timed_out, releases the lock, and runs the next job", async () => {
    const store = createMemoryJobStore();
    const hang = deferred<Record<string, unknown>>();
    const loadsStarted = deferred<void>();

    const runtime = createJobRuntime({
      store,
      waitPollMs: 10,
      getDefinition: (jobId) => {
        const definition = getJobDefinition(jobId);
        if (!definition) {
          return undefined;
        }
        return {
          ...definition,
          timeoutMs: jobId === "samsara.telemetry" ? 40 : 500,
        };
      },
      handlers: {
        async "samsara.telemetry"() {
          return hang.promise;
        },
        async "openroad.loads"() {
          loadsStarted.resolve();
          return { ok: true };
        },
      },
    });

    const telemetry = await runtime.enqueue("samsara.telemetry", "schedule");
    await runtime.enqueue("openroad.loads", "schedule");
    await loadsStarted.promise;

    const finished = await store.getRun(telemetry.run.id);
    assert.equal(finished?.status, "timed_out");
    hang.resolve({ late: true });
    await runtime.stop();
  });

  it("marks a failed upstream sync without crashing or leaving an unhandled rejection", async () => {
    const store = createMemoryJobStore();
    const rejections: unknown[] = [];
    const onRejection = (reason: unknown) => {
      rejections.push(reason);
    };
    process.on("unhandledRejection", onRejection);

    const runtime = createJobRuntime({
      store,
      waitPollMs: 10,
      handlers: {
        async "openroad.loads"() {
          throw new Error("Open Road API is unreachable: fetch failed");
        },
      },
    });

    try {
      const enqueued = await runtime.enqueue("openroad.loads", "schedule");
      await waitUntil(async () => {
        const run = await store.getRun(enqueued.run.id);
        return run?.status === "failed";
      });
      await sleep(30);

      const finished = await store.getRun(enqueued.run.id);
      assert.equal(finished?.status, "failed");
      assert.match(finished?.error ?? "", /unreachable/);
      assert.equal(rejections.length, 0);
    } finally {
      process.off("unhandledRejection", onRejection);
      await runtime.stop();
    }
  });
});

describe("job scheduler", () => {
  it("does not enqueue on the ready minute and only fires the next due slot", async () => {
    const enqueued: JobId[] = [];
    const scheduler = createJobScheduler({
      startupDelayMs: 45_000,
      enqueue: async (jobId) => {
        enqueued.push(jobId);
      },
    });

    const readyAt = new Date("2026-08-28T12:00:20.000Z");
    scheduler.markReady(readyAt);

    assert.deepEqual((await scheduler.tick(readyAt)).enqueued, []);
    assert.deepEqual((await scheduler.tick(new Date("2026-08-28T12:00:59.000Z"))).enqueued, []);

    const nextSlot = await scheduler.tick(new Date("2026-08-28T12:05:00.000Z"));
    assert.ok(nextSlot.enqueued.includes("samsara.telemetry"));
    assert.equal(nextSlot.enqueued.includes("openroad.loads"), false);

    const repeat = await scheduler.tick(new Date("2026-08-28T12:05:30.000Z"));
    assert.deepEqual(repeat.enqueued, []);
  });

  it("does not enqueue before the startup delay elapses", async () => {
    const enqueued: JobId[] = [];
    const scheduler = createJobScheduler({
      startupDelayMs: 45_000,
      enqueue: async (jobId) => {
        enqueued.push(jobId);
      },
    });

    const due = await scheduler.tick(new Date("2026-08-28T12:05:00.000Z"));
    assert.deepEqual(due.enqueued, []);
    assert.equal(scheduler.getReadyAt(), null);
    assert.deepEqual(enqueued, []);
  });
});
