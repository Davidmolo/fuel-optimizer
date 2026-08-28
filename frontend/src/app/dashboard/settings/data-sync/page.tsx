"use client";

import { useMemo } from "react";
import Alert from "@/components/common/alert";
import Card from "@/components/common/card";
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
      <Card compact>
        <p className="text-sm font-medium text-foreground">Background data sync</p>
        <p className="mt-1 text-sm text-muted">
          Jobs run one at a time so Samsara, Open Road, and Relay never pile onto the server together.
          Live GPS refreshes most often because fuel recommendations need a current truck position.
        </p>
        <p className="mt-3 text-xs text-muted">
          Scheduler {data.enabled ? "on" : "off"} · max {data.maxConcurrency} job at a time
          {runningName ? ` · currently running ${runningName}` : ""}
        </p>
      </Card>

      <div className="overflow-x-auto rounded-[var(--radius-xl)] border border-border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-surface-muted text-xs font-medium tracking-wide text-muted uppercase">
            <tr>
              <th className="px-4 py-3">Job</th>
              <th className="px-4 py-3">Cadence</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last run</th>
              <th className="px-4 py-3">Next</th>
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
