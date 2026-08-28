"use client";

import { useMemo } from "react";
import Alert from "@/components/common/alert";
import Spinner from "@/components/common/spinner";
import { useJobsStatus } from "@/hooks/use-jobs-status";
import { formatDurationMs, formatRelativeFuture } from "@/lib/job-status";
import { formatFleetRelativeAge, formatFleetTimestamp } from "@/lib/fleet-utils";
import { cn } from "@/lib/utils";
import type { JobRunStatus } from "@/types/jobs";

const STATUS_LABELS: Record<JobRunStatus, string> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
  skipped: "Skipped",
  timed_out: "Timed out",
};

function statusClass(status?: JobRunStatus | "idle" | "queued" | "running") {
  if (status === "running" || status === "queued") {
    return "text-primary";
  }
  if (status === "failed" || status === "timed_out") {
    return "text-danger";
  }
  if (status === "skipped") {
    return "text-warning";
  }
  if (status === "succeeded") {
    return "text-success";
  }
  return "text-muted";
}

export default function DataSyncSettingsPage() {
  const { data, loading } = useJobsStatus(15_000);
  const jobs = useMemo(() => data?.jobs.filter((job) => job.scheduled) ?? [], [data]);
  const runningName = data?.jobs.find((job) => job.id === data.running?.jobId)?.name;

  if (loading && !data) {
    return <Spinner label="Loading sync jobs..." />;
  }

  if (!data) {
    return <Alert variant="error">Unable to load sync job status.</Alert>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="max-w-2xl">
          <h2 className="text-base font-semibold tracking-tight text-foreground">Background data sync</h2>
          <p className="mt-1 text-sm text-muted">
            Jobs run one at a time. Live GPS updates most often so fuel recommendations have a current truck
            position.
          </p>
        </div>
        <p className="text-xs text-muted">
          Scheduler {data.enabled ? "on" : "off"}
          <span aria-hidden="true"> · </span>
          {data.maxConcurrency} at a time
          {runningName ? (
            <>
              <span aria-hidden="true"> · </span>
              Running {runningName}
            </>
          ) : null}
        </p>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-xl)] border border-border bg-surface">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-surface-muted text-xs font-medium tracking-wide text-muted uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Job</th>
              <th className="px-4 py-3 font-medium">Cadence</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last run</th>
              <th className="px-4 py-3 font-medium">Next</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => {
              const last = job.lastRun;
              const status = job.queueStatus === "idle" ? last?.status : job.queueStatus;

              return (
                <tr key={job.id} className="border-t border-border align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{job.name}</p>
                    <p className="mt-1 text-xs text-muted">{job.description}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted">{job.cadenceLabel}</td>
                  <td className={cn("px-4 py-3 whitespace-nowrap", statusClass(status))}>
                    {job.queueStatus === "idle"
                      ? last
                        ? STATUS_LABELS[last.status]
                        : "Idle"
                      : job.queueStatus === "running"
                        ? "Running"
                        : "Queued"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {last ? (
                      <>
                        <p>{formatFleetTimestamp(last.finishedAt ?? last.startedAt ?? last.queuedAt)}</p>
                        <p className="mt-1 text-xs">
                          {formatFleetRelativeAge(last.finishedAt ?? last.startedAt)} · {formatDurationMs(last.durationMs)}
                          {last.trigger === "manual" ? " · manual" : ""}
                        </p>
                        {last.error || last.skipReason ? (
                          <p className="mt-1 text-xs text-danger">{last.error || last.skipReason}</p>
                        ) : null}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted">
                    {data.enabled ? formatRelativeFuture(job.nextRunAt) ?? "—" : "Off"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
