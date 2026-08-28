/** Max days per Relay fuel-transactions request (large windows return empty or fail). */
export const DEFAULT_RELAY_TRANSACTION_CHUNK_DAYS = 7;

export type RelayDateWindow = {
  dtstart: string;
  dtend: string;
};

export function splitDateRangeIntoWindows(
  dtstart: string,
  dtend: string,
  chunkDays = DEFAULT_RELAY_TRANSACTION_CHUNK_DAYS,
): RelayDateWindow[] {
  const start = new Date(dtstart);
  const end = new Date(dtend);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    return [{ dtstart, dtend }];
  }

  if (chunkDays <= 0) {
    return [{ dtstart, dtend }];
  }

  const chunkMs = chunkDays * 24 * 60 * 60 * 1000;
  const rangeMs = end.getTime() - start.getTime();

  if (rangeMs <= chunkMs) {
    return [{ dtstart, dtend }];
  }

  const windows: RelayDateWindow[] = [];
  let cursor = start;

  while (cursor < end) {
    const nextEnd = new Date(Math.min(cursor.getTime() + chunkMs, end.getTime()));
    windows.push({
      dtstart: cursor.toISOString(),
      dtend: nextEnd.toISOString(),
    });
    cursor = nextEnd;
  }

  return windows;
}
