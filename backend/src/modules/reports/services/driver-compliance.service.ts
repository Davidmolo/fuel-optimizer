import type { RelayAccount } from "../../../integrations/relay";
import {
  resolveDispatcherFleetScope,
  type FleetScopeActor,
} from "../../fleet/services/dispatcher-fleet-scope";
import { TmsDriverModel } from "../../tms/models/tms-driver.model";
import {
  TmsLoadModel,
  type TrimbleTripFuelStopRecord,
  type TmsLoadDocument,
} from "../../tms/models/tms-load.model";
import { isTrimbleFuelStopArrived } from "../../tms/services/fuel-stop-status";
import { RelayFuelTransactionModel } from "../models/relay-fuel-transaction.model";
import {
  aggregateDriverCompliance,
  COMPLIANCE_MATCH_WINDOW_DAYS,
  matchPlannedStopsToTransactions,
  type FuelTransactionInput,
  type PlannedFuelStopInput,
} from "./driver-compliance.matching";

function isRelayAccount(value: string): value is RelayAccount {
  return value === "blue_stallion" || value === "azfs";
}

export type DriverComplianceQuery = {
  from: Date;
  to: Date;
  driverId?: number;
  actor?: FleetScopeActor | null;
};

export type DriverComplianceDriverRow = {
  driverId: number | null;
  driverName: string;
  assignedStops: number;
  followedStops: number;
  missedStops: number;
  arrivedStops: number;
  purchasedStops: number;
  gpsNearStops: number;
  compliancePercent: number;
};

export type DriverComplianceReport = {
  from: string;
  to: string;
  matchWindowDays: number;
  totals: {
    assignedStops: number;
    followedStops: number;
    missedStops: number;
    arrivedStops: number;
    purchasedStops: number;
    gpsNearStops: number;
    compliancePercent: number;
    driverCount: number;
  };
  drivers: DriverComplianceDriverRow[];
};

function plannedStopsFromLoad(load: TmsLoadDocument): PlannedFuelStopInput[] {
  const trip = load.trimbleTrip;
  if (!trip) {
    return [];
  }

  const stops: TrimbleTripFuelStopRecord[] = trip.fuelStops?.length
    ? trip.fuelStops
    : trip.fuelStop
      ? [trip.fuelStop]
      : [];

  const loadId = String(load._id);
  const tripCompleted = String(trip.tripStatus ?? "").toLowerCase() === "completed";
  const matchWindowEndAt =
    tripCompleted && trip.refreshedAt
      ? trip.refreshedAt instanceof Date
        ? trip.refreshedAt
        : new Date(trip.refreshedAt)
      : undefined;

  return stops.map((stop, index) => ({
    key: `${loadId}:${stop.relayAccount}:${stop.relayLocationId}:${stop.stopIndex}:${index}`,
    driverId: load.primaryDriverId ?? null,
    relayAccount: stop.relayAccount,
    relayLocationId: stop.relayLocationId,
    insertedAt: stop.insertedAt instanceof Date ? stop.insertedAt : new Date(stop.insertedAt),
    matchWindowEndAt,
    trimbleArrived: isTrimbleFuelStopArrived(stop),
    gpsNear: Boolean(stop.gpsNearAt),
  }));
}

function driverDisplayName(driver: {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  openroadDriverId: number;
} | null | undefined) {
  if (!driver) {
    return "Unassigned driver";
  }

  if (driver.displayName?.trim()) {
    return driver.displayName.trim();
  }

  const name = [driver.firstName, driver.lastName].filter(Boolean).join(" ").trim();
  if (name) {
    return name;
  }

  return `Driver ${driver.openroadDriverId}`;
}

function emptyComplianceReport(from: Date, to: Date): DriverComplianceReport {
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    matchWindowDays: COMPLIANCE_MATCH_WINDOW_DAYS,
    totals: {
      assignedStops: 0,
      followedStops: 0,
      missedStops: 0,
      arrivedStops: 0,
      purchasedStops: 0,
      gpsNearStops: 0,
      compliancePercent: 0,
      driverCount: 0,
    },
    drivers: [],
  };
}

export async function getDriverComplianceReport(
  query: DriverComplianceQuery,
): Promise<DriverComplianceReport> {
  const { from, to, driverId, actor } = query;

  const scope = await resolveDispatcherFleetScope(actor);
  if (scope.mode === "none") {
    return emptyComplianceReport(from, to);
  }

  const loadFilter: Record<string, unknown> = {
    $or: [
      {
        "trimbleTrip.fuelStops": {
          $elemMatch: {
            insertedAt: { $gte: from, $lte: to },
          },
        },
      },
      {
        "trimbleTrip.fuelStop.insertedAt": { $gte: from, $lte: to },
      },
    ],
  };

  if (scope.mode === "dispatcher") {
    const scopeClauses: Record<string, unknown>[] = [];
    if (scope.unitNumbers.length > 0) {
      scopeClauses.push({ truckUnit: { $in: scope.unitNumbers } });
    }
    if (scope.openroadDriverIds.length > 0) {
      scopeClauses.push({ primaryDriverId: { $in: scope.openroadDriverIds } });
    }
    if (scopeClauses.length === 0) {
      return emptyComplianceReport(from, to);
    }
    loadFilter.$and = [...(Array.isArray(loadFilter.$and) ? loadFilter.$and : []), { $or: scopeClauses }];
  }

  if (driverId !== undefined) {
    loadFilter.primaryDriverId = driverId;
  }

  const loads = await TmsLoadModel.find(loadFilter).lean();

  const plannedStops = loads
    .flatMap((load) => plannedStopsFromLoad(load as TmsLoadDocument))
    .filter((stop) => stop.insertedAt >= from && stop.insertedAt <= to);

  if (plannedStops.length === 0) {
    return emptyComplianceReport(from, to);
  }

  const earliestInserted = plannedStops.reduce(
    (min, stop) => (stop.insertedAt < min ? stop.insertedAt : min),
    plannedStops[0]!.insertedAt,
  );
  const latestWindowEnd = plannedStops.reduce((max, stop) => {
    const end = new Date(stop.insertedAt);
    end.setUTCDate(end.getUTCDate() + COMPLIANCE_MATCH_WINDOW_DAYS);
    const effective = stop.matchWindowEndAt && stop.matchWindowEndAt < end ? stop.matchWindowEndAt : end;
    return effective > max ? effective : max;
  }, earliestInserted);

  const accounts = [
    ...new Set(plannedStops.map((stop) => stop.relayAccount).filter(isRelayAccount)),
  ];
  const locationIds = [...new Set(plannedStops.map((stop) => stop.relayLocationId))];

  const transactions = await RelayFuelTransactionModel.find({
    relayAccount: { $in: accounts },
    locationId: { $in: locationIds },
    occurredAt: { $gte: earliestInserted, $lte: latestWindowEnd },
  }).lean();

  const transactionInputs: FuelTransactionInput[] = transactions.map((transaction) => ({
    key: `${transaction.relayAccount}:${transaction.transactionId}`,
    relayAccount: transaction.relayAccount,
    locationId: transaction.locationId,
    occurredAt:
      transaction.occurredAt instanceof Date
        ? transaction.occurredAt
        : new Date(transaction.occurredAt),
  }));

  const matches = matchPlannedStopsToTransactions(plannedStops, transactionInputs);
  const aggregated = aggregateDriverCompliance(matches);

  const driverIds = aggregated
    .map((row) => row.driverId)
    .filter((id): id is number => typeof id === "number");

  const drivers =
    driverIds.length > 0
      ? await TmsDriverModel.find({ openroadDriverId: { $in: driverIds } }).lean()
      : [];

  const driverById = new Map(drivers.map((driver) => [driver.openroadDriverId, driver]));

  const driverRows: DriverComplianceDriverRow[] = aggregated.map((row) => ({
    driverId: row.driverId,
    driverName:
      row.driverId === null
        ? "Unassigned driver"
        : driverDisplayName(driverById.get(row.driverId)),
    assignedStops: row.assignedStops,
    followedStops: row.followedStops,
    missedStops: row.missedStops,
    arrivedStops: row.arrivedStops,
    purchasedStops: row.purchasedStops,
    gpsNearStops: row.gpsNearStops,
    compliancePercent: row.compliancePercent,
  }));

  const assignedStops = driverRows.reduce((sum, row) => sum + row.assignedStops, 0);
  const followedStops = driverRows.reduce((sum, row) => sum + row.followedStops, 0);
  const arrivedStops = driverRows.reduce((sum, row) => sum + row.arrivedStops, 0);
  const purchasedStops = driverRows.reduce((sum, row) => sum + row.purchasedStops, 0);
  const gpsNearStops = driverRows.reduce((sum, row) => sum + row.gpsNearStops, 0);
  const missedStops = assignedStops - followedStops;
  const compliancePercent =
    assignedStops === 0 ? 0 : Math.round((followedStops / assignedStops) * 1000) / 10;

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    matchWindowDays: COMPLIANCE_MATCH_WINDOW_DAYS,
    totals: {
      assignedStops,
      followedStops,
      missedStops,
      arrivedStops,
      purchasedStops,
      gpsNearStops,
      compliancePercent,
      driverCount: driverRows.length,
    },
    drivers: driverRows,
  };
}
