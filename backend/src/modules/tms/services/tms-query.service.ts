import { HttpError } from "../../../utils/http-error";
import { isValidObjectId } from "mongoose";
import { FleetVehicleModel } from "../../fleet/models/fleet-vehicle.model";
import { toFleetVehicleView } from "../../fleet/mappers/fleet-vehicle.mapper";
import {
  deriveDriverAcceptLabel,
  evaluateCopilotSendReadiness,
  resolveDispatcherFleetScope,
  truckUnitInScope,
  type FleetScopeActor,
} from "../../fleet/services/dispatcher-fleet-scope";
import { getSamsaraTelemetryStaleMs } from "../../../integrations/samsara";
import { TmsAssignmentModel } from "../models/tms-assignment.model";
import { TmsDriverModel } from "../models/tms-driver.model";
import { TmsLoadModel } from "../models/tms-load.model";
import {
  buildTmsSummary,
  toTmsLoadView,
  type TripContextView,
  type TmsDriverView,
} from "../mappers/trip-context.mapper";
import { isDemoDriver, normalizeVin } from "../utils/tms-normalize";

type ListActiveLoadsOptions = {
  truckUnit?: string;
  actor?: FleetScopeActor | null;
};

function buildActiveLoadLookupFilter(identifier: string) {
  const numericId = Number(identifier);

  if (Number.isFinite(numericId)) {
    return { openroadLoadId: numericId, isActive: true };
  }

  if (isValidObjectId(identifier)) {
    return { _id: identifier, isActive: true };
  }

  return null;
}

async function findActiveLoadByIdentifier(identifier: string) {
  const filter = buildActiveLoadLookupFilter(identifier);
  if (!filter) {
    return null;
  }

  return TmsLoadModel.findOne(filter).lean();
}

export async function listActiveLoads(options: ListActiveLoadsOptions = {}) {
  const filter: Record<string, unknown> = { isActive: true };
  const scope = await resolveDispatcherFleetScope(options.actor);

  if (scope.mode === "none") {
    return {
      summary: buildTmsSummary([]),
      items: [],
      fleetScope: { mode: scope.mode, reason: scope.reason },
    };
  }

  if (scope.mode === "dispatcher") {
    if (scope.unitNumbers.length === 0) {
      return {
        summary: buildTmsSummary([]),
        items: [],
        fleetScope: { mode: scope.mode, dispatcherName: scope.dispatcherName },
      };
    }
    filter.truckUnit = options.truckUnit
      ? options.truckUnit
      : { $in: scope.unitNumbers };
    if (options.truckUnit && !scope.unitNumbers.includes(options.truckUnit)) {
      return {
        summary: buildTmsSummary([]),
        items: [],
        fleetScope: { mode: scope.mode, dispatcherName: scope.dispatcherName },
      };
    }
  } else if (options.truckUnit) {
    filter.truckUnit = options.truckUnit;
  }

  const loads = await TmsLoadModel.find(filter).sort({ updatedAt: -1 }).lean();
  const items = loads.map(toTmsLoadView);

  return {
    summary: buildTmsSummary(items),
    items,
    fleetScope:
      scope.mode === "dispatcher"
        ? { mode: scope.mode, dispatcherName: scope.dispatcherName }
        : { mode: "all" as const },
  };
}

export async function getActiveLoad(loadId: string) {
  const load = await findActiveLoadByIdentifier(loadId);

  if (!load) {
    throw new HttpError("Active load not found", 404);
  }

  return toTmsLoadView(load);
}

async function findFleetVehicle(identifier: string) {
  const numericId = Number(identifier);
  const normalizedVin = normalizeVin(identifier);

  return FleetVehicleModel.findOne({
    $or: [
      { unitNumber: identifier },
      { samsaraId: identifier },
      ...(normalizedVin ? [{ vin: normalizedVin }] : []),
      ...(Number.isFinite(numericId) ? [{ openroadTruckId: numericId }] : []),
    ],
  }).lean();
}

async function findFleetVehicleForLoad(load: { openroadTruckId?: number; samsaraVehicleId?: string }) {
  if (!load.openroadTruckId && !load.samsaraVehicleId) {
    return null;
  }

  return FleetVehicleModel.findOne({
    $or: [
      ...(load.openroadTruckId ? [{ openroadTruckId: load.openroadTruckId }] : []),
      ...(load.samsaraVehicleId ? [{ samsaraId: load.samsaraVehicleId }] : []),
    ],
  }).lean();
}

function toDriverView(driver: {
  openroadDriverId: number;
  employeeNr?: string;
  displayName?: string;
  phone?: string;
  team?: string;
  status?: string;
}): TmsDriverView {
  return {
    openroadDriverId: driver.openroadDriverId,
    employeeNr: driver.employeeNr,
    displayName: driver.displayName,
    phone: driver.phone,
    team: driver.team,
    status: driver.status,
  };
}

function buildCopilotSendView(args: {
  fleetVehicle?: {
    trimbleAssetId?: string;
    tripManagementEnabled?: boolean;
    copilotStatus?: string;
    dispatcherName?: string;
  } | null;
  tripStatus?: string;
  tspDriverId?: string | null;
  fuelStopOnTrip: boolean;
}): TripContextView["copilot"] {
  const readiness = evaluateCopilotSendReadiness(args.fleetVehicle ?? null);

  return {
    canSend: readiness.canSend,
    blockedReason: readiness.blockedReason,
    driverAcceptStatus: deriveDriverAcceptLabel(args.tripStatus),
    tripStatus: args.tripStatus,
    tspDriverId: args.tspDriverId ?? readiness.trimbleAssetId ?? null,
    fuelStopOnTrip: args.fuelStopOnTrip,
  };
}

function toTripVehicleView(
  fleetVehicle: NonNullable<Awaited<ReturnType<typeof findFleetVehicleForLoad>>>,
  staleThresholdMs: number,
) {
  const fleetView = toFleetVehicleView(fleetVehicle, staleThresholdMs);
  return {
    fleetVehicleId: fleetView.id,
    samsaraId: fleetView.samsaraId,
    unitNumber: fleetView.unitNumber,
    mappingStatus: fleetVehicle.mappingStatus,
    fuelTankCapacityGallons: fleetView.fuelTankCapacityGallons,
    trimbleAssetId: fleetView.trimbleAssetId,
    tripManagementEnabled: fleetView.tripManagementEnabled,
    copilotStatus: fleetView.copilotStatus,
    dispatcherName: fleetView.dispatcherName,
    gps: fleetView.gps,
    fuel: fleetView.fuel,
  };
}

async function buildTripContextForLoad(loadId: string): Promise<TripContextView> {
  const load = await findActiveLoadByIdentifier(loadId);

  if (!load) {
    throw new HttpError("Active load not found", 404);
  }

  const staleThresholdMs = getSamsaraTelemetryStaleMs();
  const loadView = toTmsLoadView(load);

  let driver: TmsDriverView | undefined;
  if (load.primaryDriverId) {
    const driverDoc = await TmsDriverModel.findOne({ openroadDriverId: load.primaryDriverId }).lean();
    if (driverDoc) {
      driver = toDriverView(driverDoc);
    }
  }

  let vehicle;
  const fleetVehicle = await findFleetVehicleForLoad(load);
  if (fleetVehicle) {
    vehicle = toTripVehicleView(fleetVehicle, staleThresholdMs);
  }

  const hasDriver = Boolean(driver);
  const hasTruckAssignment = Boolean(load.truckUnit);
  const hasFleetVehicle = Boolean(vehicle);
  const hasTelemetry = Boolean(
    vehicle?.gps?.freshness === "live" && vehicle?.fuel?.freshness === "live",
  );

  return {
    load: loadView,
    driver,
    vehicle,
    linkage: {
      hasDriver,
      hasTruckAssignment,
      hasFleetVehicle,
      hasTelemetry,
      isReadyForRecommendation:
        hasDriver &&
        hasTruckAssignment &&
        hasFleetVehicle &&
        hasTelemetry &&
        Boolean(load.originCity && load.destinationCity),
    },
    copilot: buildCopilotSendView({
      fleetVehicle,
      tripStatus: load.trimbleTrip?.tripStatus,
      tspDriverId: load.trimbleTrip?.tspDriverId,
      fuelStopOnTrip: Boolean(
        load.trimbleTrip?.fuelStop || (load.trimbleTrip?.fuelStops?.length ?? 0) > 0,
      ),
    }),
  };
}

export async function getTripContext(identifier: string): Promise<TripContextView> {
  const loadById = await findActiveLoadByIdentifier(identifier);

  if (loadById) {
    return buildTripContextForLoad(String(loadById._id));
  }

  const fleetVehicle = await findFleetVehicle(identifier);
  if (!fleetVehicle) {
    throw new HttpError("Trip context not found for identifier", 404);
  }

  if (!fleetVehicle.openroadTruckId && !fleetVehicle.samsaraId) {
    throw new HttpError("Fleet vehicle has no linked Open Road or Samsara identifier", 404);
  }

  const activeLoadFilters = [
    ...(fleetVehicle.openroadTruckId ? [{ openroadTruckId: fleetVehicle.openroadTruckId }] : []),
    ...(fleetVehicle.samsaraId ? [{ samsaraVehicleId: fleetVehicle.samsaraId }] : []),
    ...(fleetVehicle.unitNumber ? [{ truckUnit: fleetVehicle.unitNumber }] : []),
  ];
  const load = await TmsLoadModel.findOne({ $or: activeLoadFilters, isActive: true })
    .sort({ updatedAt: -1 })
    .lean();

  if (!load) {
    throw new HttpError(`No active load found for linked truck ${fleetVehicle.unitNumber || identifier}`, 404);
  }

  return buildTripContextForLoad(String(load._id));
}

export async function listTripContexts(actor?: FleetScopeActor | null) {
  const scope = await resolveDispatcherFleetScope(actor);

  if (scope.mode === "none") {
    return {
      summary: {
        ...buildTmsSummary([]),
        readyForRecommendationCount: 0,
        withTelemetryCount: 0,
      },
      items: [] as TripContextView[],
      fleetScope: { mode: scope.mode, reason: scope.reason },
    };
  }

  const loadFilter: Record<string, unknown> = { isActive: true };
  if (scope.mode === "dispatcher") {
    if (scope.unitNumbers.length === 0) {
      return {
        summary: {
          ...buildTmsSummary([]),
          readyForRecommendationCount: 0,
          withTelemetryCount: 0,
        },
        items: [] as TripContextView[],
        fleetScope: { mode: scope.mode, dispatcherName: scope.dispatcherName },
      };
    }
    loadFilter.truckUnit = { $in: scope.unitNumbers };
  }

  const loads = await TmsLoadModel.find(loadFilter).sort({ updatedAt: -1 }).lean();
  const staleThresholdMs = getSamsaraTelemetryStaleMs();

  const driverIds = loads.map((load) => load.primaryDriverId).filter((id): id is number => Boolean(id));
  const truckIds = loads.map((load) => load.openroadTruckId).filter((id): id is number => Boolean(id));
  const samsaraVehicleIds = loads
    .map((load) => load.samsaraVehicleId)
    .filter((id): id is string => Boolean(id));

  const fleetVehicleOrFilter = [
    ...(truckIds.length > 0 ? [{ openroadTruckId: { $in: truckIds } }] : []),
    ...(samsaraVehicleIds.length > 0 ? [{ samsaraId: { $in: samsaraVehicleIds } }] : []),
  ];
  const fleetVehicleFilter = fleetVehicleOrFilter.length > 0 ? { $or: fleetVehicleOrFilter } : null;

  const [drivers, fleetVehicles] = await Promise.all([
    TmsDriverModel.find({ openroadDriverId: { $in: driverIds } }).lean(),
    fleetVehicleFilter ? FleetVehicleModel.find(fleetVehicleFilter).lean() : Promise.resolve([]),
  ]);

  const driversById = new Map(drivers.map((driver) => [driver.openroadDriverId, driver]));
  const vehiclesByOpenRoadId = new Map(
    fleetVehicles
      .filter((vehicle) => vehicle.openroadTruckId)
      .map((vehicle) => [vehicle.openroadTruckId as number, vehicle]),
  );
  const vehiclesBySamsaraId = new Map(
    fleetVehicles
      .filter((vehicle) => vehicle.samsaraId)
      .map((vehicle) => [vehicle.samsaraId as string, vehicle]),
  );

  const eligibleLoads = loads.filter((load) => {
    if (!truckUnitInScope(scope, load.truckUnit)) {
      return false;
    }
    const driverDoc = load.primaryDriverId ? driversById.get(load.primaryDriverId) : undefined;
    return !driverDoc || (driverDoc.isActive && !isDemoDriver(driverDoc));
  });

  const items: TripContextView[] = eligibleLoads.map((load) => {
    const loadView = toTmsLoadView(load);
    const driverDoc = load.primaryDriverId ? driversById.get(load.primaryDriverId) : undefined;
    const fleetVehicle = load.openroadTruckId
      ? vehiclesByOpenRoadId.get(load.openroadTruckId)
      : load.samsaraVehicleId
        ? vehiclesBySamsaraId.get(load.samsaraVehicleId)
        : undefined;
    const vehicle = fleetVehicle ? toTripVehicleView(fleetVehicle, staleThresholdMs) : undefined;

    const hasDriver = Boolean(driverDoc);
    const hasTruckAssignment = Boolean(load.truckUnit);
    const hasFleetVehicle = Boolean(vehicle);
    const hasTelemetry = Boolean(
      vehicle?.gps?.freshness === "live" && vehicle?.fuel?.freshness === "live",
    );

    return {
      load: loadView,
      driver: driverDoc ? toDriverView(driverDoc) : undefined,
      vehicle,
      linkage: {
        hasDriver,
        hasTruckAssignment,
        hasFleetVehicle,
        hasTelemetry,
        isReadyForRecommendation:
          hasDriver &&
          hasTruckAssignment &&
          hasFleetVehicle &&
          hasTelemetry &&
          Boolean(load.originCity && load.destinationCity),
      },
      copilot: buildCopilotSendView({
        fleetVehicle,
        tripStatus: load.trimbleTrip?.tripStatus,
        tspDriverId: load.trimbleTrip?.tspDriverId,
        fuelStopOnTrip: Boolean(
        load.trimbleTrip?.fuelStop || (load.trimbleTrip?.fuelStops?.length ?? 0) > 0,
      ),
      }),
    };
  });

  return {
    summary: {
      ...buildTmsSummary(items.map((item) => item.load)),
      readyForRecommendationCount: items.filter((item) => item.linkage.isReadyForRecommendation).length,
      withTelemetryCount: items.filter((item) => item.linkage.hasTelemetry).length,
    },
    items,
    fleetScope:
      scope.mode === "dispatcher"
        ? { mode: scope.mode, dispatcherName: scope.dispatcherName }
        : { mode: "all" as const },
  };
}

export async function listAssignments() {
  const assignments = await TmsAssignmentModel.find({ isCurrent: true, assignmentType: "Truck" })
    .sort({ truckUnit: 1 })
    .lean();

  return {
    totalAssignments: assignments.length,
    items: assignments.map((assignment) => ({
      openroadAssignmentId: assignment.openroadAssignmentId,
      openroadDriverId: assignment.openroadDriverId,
      driverName: assignment.driverName,
      driverNr: assignment.driverNr,
      truckUnit: assignment.truckUnit,
      openroadTruckId: assignment.openroadTruckId,
      driverTeam: assignment.driverTeam,
      startDate: assignment.startDate?.toISOString(),
      syncedAt: assignment.syncedAt?.toISOString(),
    })),
  };
}
