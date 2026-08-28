export class SkipJobError extends Error {
  reason: string;

  constructor(reason: string) {
    super(reason);
    this.name = "SkipJobError";
    this.reason = reason;
  }
}

export class JobTimeoutError extends Error {
  timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Job timed out after ${timeoutMs}ms`);
    this.name = "JobTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}
