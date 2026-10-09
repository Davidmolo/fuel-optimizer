export const COMPLIANCE_MATCH_WINDOW_DAYS = 7;

export type PlannedFuelStopInput = {
  key: string;
  driverId: number | null;
  relayAccount: string;
  relayLocationId: string;
  insertedAt: Date;
  /** Optional tighter end of Relay match window (e.g. trip completedAt). */
  matchWindowEndAt?: Date;
  trimbleArrived?: boolean;
  gpsNear?: boolean;
};

export type FuelTransactionInput = {
  key: string;
  relayAccount: string;
  locationId: string;
  occurredAt: Date;
};

export type PlannedFuelStopMatchResult = PlannedFuelStopInput & {
  followed: boolean;
  trimbleArrived: boolean;
  relayPurchased: boolean;
  gpsNear: boolean;
  matchedTransactionKey?: string;
};

function defaultMatchWindowEnd(insertedAt: Date, windowDays: number) {
  const end = new Date(insertedAt);
  end.setUTCDate(end.getUTCDate() + windowDays);
  return end;
}

function resolveMatchWindowEnd(stop: PlannedFuelStopInput, windowDays: number) {
  const defaultEnd = defaultMatchWindowEnd(stop.insertedAt, windowDays);
  if (!stop.matchWindowEndAt) {
    return defaultEnd;
  }
  return stop.matchWindowEndAt < defaultEnd ? stop.matchWindowEndAt : defaultEnd;
}

/**
 * Dual-signal compliance:
 * followed = Trimble arrived/completed OR Relay purchase at the planned station.
 * GPS near is evidence only and does not count as followed by itself.
 * Each transaction can match at most one stop (earliest planned stop first).
 */
export function matchPlannedStopsToTransactions(
  stops: PlannedFuelStopInput[],
  transactions: FuelTransactionInput[],
  windowDays = COMPLIANCE_MATCH_WINDOW_DAYS,
): PlannedFuelStopMatchResult[] {
  const sortedStops = [...stops].sort((a, b) => a.insertedAt.getTime() - b.insertedAt.getTime());
  const sortedTransactions = [...transactions].sort(
    (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
  );
  const usedTransactionKeys = new Set<string>();

  return sortedStops.map((stop) => {
    const windowEnd = resolveMatchWindowEnd(stop, windowDays);
    const match = sortedTransactions.find((transaction) => {
      if (usedTransactionKeys.has(transaction.key)) {
        return false;
      }
      if (transaction.relayAccount !== stop.relayAccount) {
        return false;
      }
      if (transaction.locationId !== stop.relayLocationId) {
        return false;
      }
      if (transaction.occurredAt < stop.insertedAt) {
        return false;
      }
      if (transaction.occurredAt > windowEnd) {
        return false;
      }
      return true;
    });

    const trimbleArrived = stop.trimbleArrived === true;
    const relayPurchased = Boolean(match);
    const gpsNear = stop.gpsNear === true;

    if (match) {
      usedTransactionKeys.add(match.key);
    }

    return {
      ...stop,
      trimbleArrived,
      relayPurchased,
      gpsNear,
      followed: trimbleArrived || relayPurchased,
      matchedTransactionKey: match?.key,
    };
  });
}

export type DriverComplianceRow = {
  driverId: number | null;
  assignedStops: number;
  followedStops: number;
  missedStops: number;
  arrivedStops: number;
  purchasedStops: number;
  gpsNearStops: number;
  compliancePercent: number;
};

export function aggregateDriverCompliance(matches: PlannedFuelStopMatchResult[]): DriverComplianceRow[] {
  const byDriver = new Map<
    number | null,
    {
      assigned: number;
      followed: number;
      arrived: number;
      purchased: number;
      gpsNear: number;
    }
  >();

  for (const match of matches) {
    const current = byDriver.get(match.driverId) ?? {
      assigned: 0,
      followed: 0,
      arrived: 0,
      purchased: 0,
      gpsNear: 0,
    };
    current.assigned += 1;
    if (match.followed) {
      current.followed += 1;
    }
    if (match.trimbleArrived) {
      current.arrived += 1;
    }
    if (match.relayPurchased) {
      current.purchased += 1;
    }
    if (match.gpsNear) {
      current.gpsNear += 1;
    }
    byDriver.set(match.driverId, current);
  }

  return [...byDriver.entries()]
    .map(([driverId, counts]) => {
      const compliancePercent =
        counts.assigned === 0 ? 0 : Math.round((counts.followed / counts.assigned) * 1000) / 10;

      return {
        driverId,
        assignedStops: counts.assigned,
        followedStops: counts.followed,
        missedStops: counts.assigned - counts.followed,
        arrivedStops: counts.arrived,
        purchasedStops: counts.purchased,
        gpsNearStops: counts.gpsNear,
        compliancePercent,
      };
    })
    .sort((a, b) => {
      if (a.compliancePercent !== b.compliancePercent) {
        return a.compliancePercent - b.compliancePercent;
      }
      return (a.driverId ?? Number.MAX_SAFE_INTEGER) - (b.driverId ?? Number.MAX_SAFE_INTEGER);
    });
}
