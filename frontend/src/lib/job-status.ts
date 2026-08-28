import type { JobStatus, JobsStatusResponse } from "@/types/jobs";

export function formatRelativeFuture(value?: string | null) {
  if (!value) {
    return null;
  }

  const minutes = Math.max(0, Math.round((new Date(value).getTime() - Date.now()) / 60_000));

  if (minutes < 1) {
    return "soon";
  }

  if (minutes < 60) {
    return `in ${minutes}m`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 48) {
    return `in ${hours}h`;
  }

  return `in ${Math.round(hours / 24)}d`;
}

export function formatDurationMs(value?: number) {
  if (value === undefined || value < 0) {
    return "—";
  }

  if (value < 1000) {
    return `${value}ms`;
  }

  const seconds = Math.round(value / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

export function pickJobs(status: JobsStatusResponse | null, jobIds: string[]) {
  if (!status) {
    return [];
  }

  return jobIds
    .map((id) => status.jobs.find((job) => job.id === id))
    .filter((job): job is JobStatus => Boolean(job));
}

export function latestSuccessfulAt(jobs: JobStatus[], fallback?: string | null) {
  const timestamps = jobs
    .map((job) => (job.lastRun?.status === "succeeded" ? job.lastRun.finishedAt ?? job.lastRun.startedAt : undefined))
    .filter((value): value is string => Boolean(value))
    .sort();

  return timestamps.at(-1) ?? fallback ?? null;
}
