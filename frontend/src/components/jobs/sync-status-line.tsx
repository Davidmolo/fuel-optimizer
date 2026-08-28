"use client";

import { useJobsStatus } from "@/hooks/use-jobs-status";
import { formatRelativeFuture, latestSuccessfulAt, pickJobs } from "@/lib/job-status";
import { formatFleetRelativeAge } from "@/lib/fleet-utils";

type SyncStatusLineProps = {
  jobIds: string[];
  lastManualSyncAt?: string | null;
};

export default function SyncStatusLine({ jobIds, lastManualSyncAt }: SyncStatusLineProps) {
  const { data } = useJobsStatus();
  const jobs = pickJobs(data, jobIds);
  const primary = jobs[0];

  if (!primary) {
    if (!lastManualSyncAt) {
      return null;
    }

    return <p className="mt-1 text-xs text-muted">Last sync {formatFleetRelativeAge(lastManualSyncAt)}</p>;
  }

  const running = jobs.find((job) => job.queueStatus === "running");
  const queued = jobs.find((job) => job.queueStatus === "queued");
  const lastAt = latestSuccessfulAt(jobs, lastManualSyncAt);
  const nextLabel = formatRelativeFuture(primary.nextRunAt);

  let headline = data?.enabled
    ? `Auto-sync ${primary.cadenceLabel.toLowerCase()}${nextLabel ? ` · next ${nextLabel}` : ""}`
    : "Automatic sync is off";

  if (running) {
    headline = `Updating ${running.name.toLowerCase()}…`;
  } else if (queued) {
    headline = `${queued.name} queued behind another sync`;
  }

  return (
    <p className="mt-1 text-xs text-muted">
      {headline}
      {lastAt ? ` · last ${formatFleetRelativeAge(lastAt)}` : ""}
    </p>
  );
}
