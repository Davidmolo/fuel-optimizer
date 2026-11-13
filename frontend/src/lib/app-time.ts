/** Arizona does not observe daylight saving time. */
export const APP_TIME_ZONE = "America/Phoenix";

const ARIZONA_OFFSET_HOURS = 7;

export function isoDateFromParts(year: number, month: number, day: number) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return undefined;
  }

  if (year < 2000 || year > 2099 || month < 1 || month > 12 || day < 1 || day > 31) {
    return undefined;
  }

  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return undefined;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatMmddyy(isoDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) {
    return isoDate;
  }

  return `${match[2]}${match[3]}${match[1].slice(2)}`;
}

function arizonaParts(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);
}

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((item) => item.type === type)?.value ?? "";
}

export function arizonaTodayIso(now = new Date()) {
  const parts = arizonaParts(now);
  return isoDateFromParts(Number(part(parts, "year")), Number(part(parts, "month")), Number(part(parts, "day")));
}

export function addIsoDays(isoDate: string, days: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) {
    return undefined;
  }

  const utc = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return isoDateFromParts(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate());
}

export function formatAppDate(value?: string | null) {
  if (!value) {
    return "—";
  }

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    return formatMmddyy(value);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const parts = arizonaParts(date);
  const iso = isoDateFromParts(Number(part(parts, "year")), Number(part(parts, "month")), Number(part(parts, "day")));
  return iso ? formatMmddyy(iso) : "—";
}

export function formatAppDateTime(value?: string | null) {
  if (!value) {
    return "—";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return formatMmddyy(value);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const parts = arizonaParts(date);
  const iso = isoDateFromParts(Number(part(parts, "year")), Number(part(parts, "month")), Number(part(parts, "day")));
  if (!iso) {
    return "—";
  }

  return `${formatMmddyy(iso)} ${part(parts, "hour")}:${part(parts, "minute")} ${part(parts, "dayPeriod")}`;
}

export function arizonaDayStartIso(isoDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) {
    return undefined;
  }

  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), ARIZONA_OFFSET_HOURS),
  ).toISOString();
}

export function arizonaDayEndIso(isoDate: string) {
  const next = addIsoDays(isoDate, 1);
  const start = next ? arizonaDayStartIso(next) : undefined;
  if (!start) {
    return undefined;
  }

  return new Date(new Date(start).getTime() - 1).toISOString();
}
