function parseField(field: string, min: number, max: number): Set<number> {
  const values = new Set<number>();

  for (const part of field.split(",")) {
    if (part === "*") {
      for (let value = min; value <= max; value += 1) {
        values.add(value);
      }
      continue;
    }

    const [rangePart, stepPart] = part.split("/");
    const step = stepPart ? Number(stepPart) : 1;

    if (!Number.isInteger(step) || step < 1) {
      throw new Error(`Invalid cron step in "${field}"`);
    }

    let rangeStart = min;
    let rangeEnd = max;

    if (rangePart !== "*") {
      const bounds = rangePart.split("-");
      rangeStart = Number(bounds[0]);
      rangeEnd = bounds[1] === undefined ? (stepPart ? max : rangeStart) : Number(bounds[1]);
    }

    if (!Number.isInteger(rangeStart) || !Number.isInteger(rangeEnd) || rangeStart < min || rangeEnd > max) {
      throw new Error(`Invalid cron field "${field}"`);
    }

    for (let value = rangeStart; value <= rangeEnd; value += step) {
      values.add(value);
    }
  }

  return values;
}

function parseExpression(expression: string) {
  const parts = expression.trim().split(/\s+/);

  if (parts.length !== 5) {
    throw new Error(`Cron expression must have 5 fields: ${expression}`);
  }

  return {
    minutes: parseField(parts[0], 0, 59),
    hours: parseField(parts[1], 0, 23),
    daysOfMonth: parseField(parts[2], 1, 31),
    months: parseField(parts[3], 1, 12),
    daysOfWeek: parseField(parts[4], 0, 6),
  };
}

export function matchesCron(expression: string, date: Date): boolean {
  const cron = parseExpression(expression);

  return (
    cron.minutes.has(date.getUTCMinutes()) &&
    cron.hours.has(date.getUTCHours()) &&
    cron.daysOfMonth.has(date.getUTCDate()) &&
    cron.months.has(date.getUTCMonth() + 1) &&
    cron.daysOfWeek.has(date.getUTCDay())
  );
}

export function truncateToUtcMinute(date: Date): Date {
  const truncated = new Date(date);
  truncated.setUTCSeconds(0, 0);
  return truncated;
}

export function getNextCronDate(expression: string, from: Date): Date {
  const start = truncateToUtcMinute(from);
  start.setUTCMinutes(start.getUTCMinutes() + 1);

  for (let offset = 0; offset < 366 * 24 * 60; offset += 1) {
    const candidate = new Date(start.getTime() + offset * 60_000);
    if (matchesCron(expression, candidate)) {
      return candidate;
    }
  }

  throw new Error(`Unable to find next run for cron "${expression}"`);
}
