import { isValidObjectId } from "mongoose";
import {
  buildFuelOptimizerTmsTripId,
  countRoutePathCoordinates,
  extractRoutePathPolyline,
  getTripByAlkTripId,
  getTripRoutePath,
  isFuelOptimizerTmsTripId,
  isTripDriverUnassigned,
  isTripManagementConfigured,
  modifyTrip,
  normalizeTripStatus,
  planTrip,
  type TripManagementStopInput,
} from "../../../integrations/trip-management";
import type { RelayAccount } from "../../../integrations/relay";
import { HttpError } from "../../../utils/http-error";
import type { GeoPoint } from "../../../utils/geo";
import { FleetVehicleModel } from "../../fleet/models/fleet-vehicle.model";
import { isTestCopilotAssetId } from "../../fleet/services/copilot-asset-matching";
import {
  assertLoadInDispatcherScope,
  evaluateCopilotSendReadiness,
  type FleetScopeActor,
} from "../../fleet/services/dispatcher-fleet-scope";
import type { FuelPlanStopView } from "../../recommendation/services/fuel-plan.service";
import { getRecommendationForTruck } from "../../recommendation/services/recommendation.service";
import {
  TmsLoadModel,
  type TmsLoadDocument,
  type TrimbleTripFuelStopRecord,
  type TrimbleTripStopRecord,
} from "../models/tms-load.model";
import {
  buildTripStopsWithFuelStops,
  replaceOpenFuelStops,
  recordsToTripManagementStops,
  toTrimbleTripStopRecord,
  type FuelStopStationInput,
} from "./fuel-stop-builder";
import { mapLoadDestinationsToTripStops } from "./map-load-to-trip-stops";

export type TrimbleTripView = {
  openroadLoadId: number;
  alkTripId: string;
  tmsTripId: string;
  tripStatus: string;
  tspDriverId: string | null;
  tripDistanceMiles?: number;
  tripDurationMinutes?: number;
  routePathCoordinateCount: number;
  tripUrl?: string;
  plannedAt?: string;
  refreshedAt?: string;
  reusedExisting: boolean;
  stops?: TrimbleTripStopRecord[];
  fuelStop?: TrimbleTripFuelStopRecord | null;
  fuelStops?: TrimbleTripFuelStopRecord[];
  lastRecommendationStatus?: "ready" | "not_ready" | "no_candidates";
  lastRecommendationMessage?: string;
  safety: {
    notifiesTablet: boolean;
    tspDriverIdAssigned: boolean;
    ownsTrip: boolean;
  };
};

function resolvePlannedFuelStations(
  fuelPlanStops: FuelPlanStopView[] | undefined,
): Array<FuelStopStationInput & {
  relayAccount: string;
  relayLocationId: string;
  effectivePricePerGallon?: number;
  reason?: string;
}> {
  if (!fuelPlanStops?.length) {
    return [];
  }

  return fuelPlanStops.flatMap((stop) => {
    if (
      typeof stop.latitude !== "number" ||
      typeof stop.longitude !== "number" ||
      !Number.isFinite(stop.latitude) ||
      !Number.isFinite(stop.longitude)
    ) {
      return [];
    }

    return [
      {
        relayAccount: stop.relayAccount ?? "unknown",
        relayLocationId: stop.relayLocationId,
        merchantName: stop.merchantName ?? stop.merchantDisplayName,
        name: stop.name,
        city: stop.city,
        state: stop.state,
        latitude: stop.latitude,
        longitude: stop.longitude,
        effectivePricePerGallon: stop.effectivePricePerGallon,
        suggestedGallons: stop.suggestedGallons,
        reason: stop.reason,
      },
    ];
  });
}

function buildFuelStopRecords(
  stations: ReturnType<typeof resolvePlannedFuelStations>,
  fuelStopIndexes: Array<{ stationIndex: number; stopIndex: number }>,
): TrimbleTripFuelStopRecord[] {
  const insertedAt = new Date();
  return fuelStopIndexes.flatMap((entry) => {
    const station = stations[entry.stationIndex];
    if (!station) {
      return [];
    }
    return [
      {
        relayAccount: station.relayAccount,
        relayLocationId: station.relayLocationId,
        merchantName: station.merchantName,
        name: station.name,
        city: station.city,
        state: station.state,
        latitude: station.latitude,
        longitude: station.longitude,
        effectivePricePerGallon: station.effectivePricePerGallon,
        stopIndex: entry.stopIndex,
        insertedAt,
        reason: station.reason,
      },
    ];
  });
}

export type TrimbleTripWithFuelView = TrimbleTripView & {
  recommendation: {
    status: "ready" | "not_ready" | "no_candidates";
    message: string;
  };
};

function buildLoadLookupFilter(identifier: string) {
  const numericId = Number(identifier);

  if (Number.isFinite(numericId)) {
    return { openroadLoadId: numericId };
  }

  if (isValidObjectId(identifier)) {
    return { _id: identifier };
  }

  return null;
}

async function findLoadByIdentifier(identifier: string) {
  const filter = buildLoadLookupFilter(identifier);
  if (!filter) {
    return null;
  }

  return TmsLoadModel.findOne(filter);
}

function toTrimbleTripView(
  load: TmsLoadDocument,
  options: {
    routePathCoordinateCount: number;
    tripUrl?: string;
    reusedExisting: boolean;
    tripStatus?: string;
    tspDriverId?: string | null;
    tripDistanceMiles?: number;
    tripDurationMinutes?: number;
  },
): TrimbleTripView {
  const alkTripId = load.trimbleTrip?.alkTripId;
  if (!alkTripId) {
    throw new HttpError("Load has no Trimble trip id", 404);
  }

  const tmsTripId = load.trimbleTrip?.tmsTripId ?? buildFuelOptimizerTmsTripId(load.openroadLoadId);
  const tspDriverId = options.tspDriverId ?? load.trimbleTrip?.tspDriverId ?? null;

  return {
    openroadLoadId: load.openroadLoadId,
    alkTripId,
    tmsTripId,
    tripStatus: options.tripStatus ?? load.trimbleTrip?.tripStatus ?? "Unknown",
    tspDriverId,
    tripDistanceMiles: options.tripDistanceMiles ?? load.trimbleTrip?.tripDistanceMiles,
    tripDurationMinutes: options.tripDurationMinutes ?? load.trimbleTrip?.tripDurationMinutes,
    routePathCoordinateCount: options.routePathCoordinateCount,
    tripUrl: options.tripUrl ?? load.trimbleTrip?.tripUrl,
    plannedAt: load.trimbleTrip?.plannedAt?.toISOString(),
    refreshedAt: load.trimbleTrip?.refreshedAt?.toISOString(),
    reusedExisting: options.reusedExisting,
    stops: load.trimbleTrip?.stops,
    fuelStop: load.trimbleTrip?.fuelStop ?? load.trimbleTrip?.fuelStops?.[0] ?? null,
    fuelStops:
      load.trimbleTrip?.fuelStops ??
      (load.trimbleTrip?.fuelStop ? [load.trimbleTrip.fuelStop] : undefined),
    lastRecommendationStatus: load.trimbleTrip?.lastRecommendationStatus,
    lastRecommendationMessage: load.trimbleTrip?.lastRecommendationMessage,
    safety: {
      notifiesTablet: !isTripDriverUnassigned(tspDriverId),
      tspDriverIdAssigned: !isTripDriverUnassigned(tspDriverId),
      ownsTrip: isFuelOptimizerTmsTripId(tmsTripId),
    },
  };
}

async function refreshTripSnapshot(alkTripId: string) {
  const [trip, routePath] = await Promise.all([getTripByAlkTripId(alkTripId), getTripRoutePath(alkTripId)]);

  const tripStatus = normalizeTripStatus(trip.tripStatus);
  const tspDriverId = trip.tspDriverId ?? null;

  return {
    trip,
    routePath,
    tripStatus,
    tspDriverId,
    tripDistanceMiles: trip.tripDistance,
    tripDurationMinutes: trip.tripDriveDuration ?? trip.tripDuration,
    tripUrl: trip.url,
    routePathCoordinateCount: countRoutePathCoordinates(routePath),
    routePolyline: extractRoutePathPolyline(routePath),
  };
}

async function resolveFleetVehicleForLoad(load: TmsLoadDocument) {
  const unit = load.truckUnit?.trim();
  if (!unit) return null;
  return FleetVehicleModel.findOne({ unitNumber: unit, isActive: true }).lean();
}

async function resolveTspDriverIdFromLoad(load: TmsLoadDocument): Promise<string | null> {
  const vehicle = await resolveFleetVehicleForLoad(load);
  return vehicle?.trimbleAssetId?.trim() || null;
}

async function assertProductionDispatchAllowed(
  load: TmsLoadDocument,
  tspDriverId: string,
  options: { allowTestTablet?: boolean; skipActivatedCheck?: boolean } = {},
) {
  if (isTestCopilotAssetId(tspDriverId) && !options.allowTestTablet) {
    throw new HttpError(
      `Refusing to dispatch to test tablet ${tspDriverId} without allowTestTablet=true. Production dispatch must not target 999.`,
      409,
    );
  }

  if (options.skipActivatedCheck || options.allowTestTablet) {
    return;
  }

  const vehicle = await resolveFleetVehicleForLoad(load);
  if (!vehicle) {
    return;
  }

  const readiness = evaluateCopilotSendReadiness({
    trimbleAssetId: vehicle.trimbleAssetId,
    tripManagementEnabled: vehicle.tripManagementEnabled,
    copilotStatus: vehicle.copilotStatus,
    dispatcherName: vehicle.dispatcherName,
  });

  if (!readiness.canSend && readiness.blockedReason) {
    throw new HttpError(readiness.blockedReason, 409);
  }
}

async function assertActorCanSendLoad(load: TmsLoadDocument, actor?: FleetScopeActor | null) {
  if (!actor) {
    return;
  }
  await assertLoadInDispatcherScope({
    actor,
    truckUnit: load.truckUnit,
    openroadTruckId: load.openroadTruckId,
    samsaraVehicleId: load.samsaraVehicleId,
  });
}

function assignTrimbleTripFields(
  load: TmsLoadDocument,
  fields: {
    alkTripId: string;
    tmsTripId: string;
    tripStatus?: string;
    tspDriverId?: string | null;
    tripDistanceMiles?: number;
    tripDurationMinutes?: number;
    tripUrl?: string;
    plannedAt?: Date;
    refreshedAt?: Date;
    stops?: TrimbleTripStopRecord[];
    fuelStop?: TrimbleTripFuelStopRecord | null;
    fuelStops?: TrimbleTripFuelStopRecord[];
    lastRecommendationStatus?: "ready" | "not_ready" | "no_candidates";
    lastRecommendationMessage?: string;
    clearFuelStop?: boolean;
  },
) {
  const previous = load.trimbleTrip;
  const nextFuelStops = fields.clearFuelStop
    ? []
    : fields.fuelStops !== undefined
      ? fields.fuelStops
      : fields.fuelStop !== undefined
        ? fields.fuelStop
          ? [fields.fuelStop]
          : []
        : (previous?.fuelStops ?? (previous?.fuelStop ? [previous.fuelStop] : undefined));
  const nextFuelStop = fields.clearFuelStop
    ? null
    : fields.fuelStop !== undefined
      ? fields.fuelStop
      : (nextFuelStops?.[0] ?? previous?.fuelStop ?? null);

  load.trimbleTrip = {
    alkTripId: fields.alkTripId,
    tmsTripId: fields.tmsTripId,
    tripStatus: fields.tripStatus,
    tspDriverId: fields.tspDriverId ?? null,
    tripDistanceMiles: fields.tripDistanceMiles,
    tripDurationMinutes: fields.tripDurationMinutes,
    tripUrl: fields.tripUrl,
    plannedAt: fields.plannedAt ?? previous?.plannedAt ?? new Date(),
    refreshedAt: fields.refreshedAt ?? new Date(),
    stops: fields.stops ?? previous?.stops,
    fuelStop: nextFuelStop,
    fuelStops: nextFuelStops,
    lastRecommendationStatus: fields.lastRecommendationStatus ?? previous?.lastRecommendationStatus,
    lastRecommendationMessage: fields.lastRecommendationMessage ?? previous?.lastRecommendationMessage,
  };
}

function persistDispatchedSnapshot(
  load: TmsLoadDocument,
  snapshot: Awaited<ReturnType<typeof refreshTripSnapshot>>,
  tspDriverId: string,
) {
  assignTrimbleTripFields(load, {
    alkTripId: String(snapshot.trip.alkTripId ?? load.trimbleTrip!.alkTripId),
    tmsTripId: load.trimbleTrip?.tmsTripId ?? buildFuelOptimizerTmsTripId(load.openroadLoadId),
    tripStatus: snapshot.tripStatus,
    tspDriverId,
    tripDistanceMiles: snapshot.tripDistanceMiles,
    tripDurationMinutes: snapshot.tripDurationMinutes,
    tripUrl: snapshot.tripUrl,
    plannedAt: load.trimbleTrip?.plannedAt ?? new Date(),
    refreshedAt: new Date(),
  });
}

function persistTripStopsSnapshot(
  load: TmsLoadDocument,
  snapshot: Awaited<ReturnType<typeof refreshTripSnapshot>>,
  options: {
    stops: TripManagementStopInput[];
    fuelStop?: TrimbleTripFuelStopRecord | null;
    fuelStops?: TrimbleTripFuelStopRecord[];
    clearFuelStop?: boolean;
    recommendationStatus?: "ready" | "not_ready" | "no_candidates";
    recommendationMessage?: string;
    tspDriverId?: string | null;
  },
) {
  assignTrimbleTripFields(load, {
    alkTripId: String(snapshot.trip.alkTripId ?? load.trimbleTrip!.alkTripId),
    tmsTripId: load.trimbleTrip?.tmsTripId ?? buildFuelOptimizerTmsTripId(load.openroadLoadId),
    tripStatus: snapshot.tripStatus,
    tspDriverId:
      options.tspDriverId !== undefined
        ? options.tspDriverId
        : (snapshot.tspDriverId ?? load.trimbleTrip?.tspDriverId ?? null),
    tripDistanceMiles: snapshot.tripDistanceMiles,
    tripDurationMinutes: snapshot.tripDurationMinutes,
    tripUrl: snapshot.tripUrl,
    plannedAt: load.trimbleTrip?.plannedAt ?? new Date(),
    refreshedAt: new Date(),
    stops: options.stops.map(toTrimbleTripStopRecord),
    fuelStop: options.fuelStop,
    fuelStops: options.fuelStops,
    clearFuelStop: options.clearFuelStop,
    lastRecommendationStatus: options.recommendationStatus,
    lastRecommendationMessage: options.recommendationMessage,
  });
}

function assertOwnFuelOptimizerTrip(load: TmsLoadDocument) {
  const tmsTripId = load.trimbleTrip?.tmsTripId;
  if (tmsTripId && !isFuelOptimizerTmsTripId(tmsTripId)) {
    throw new HttpError(
      `Load is linked to a non-Fuel-Optimizer Trimble trip (${tmsTripId}). Refusing to modify it.`,
      409,
    );
  }
}

/**
 * Plans a Fuel Optimizer–owned Trimble trip for a load without assigning a tablet.
 * Never sets tspDriverId. Reuses an existing fo-* trip unless force=true.
 */
export async function planTrimbleTripForLoad(
  loadId: string,
  options: { force?: boolean } = {},
): Promise<TrimbleTripView> {
  if (!isTripManagementConfigured()) {
    throw new HttpError("Trimble Trip Management is not configured. Set TRIMBLE_API_KEY.", 503);
  }

  const load = await findLoadByIdentifier(loadId);
  if (!load) {
    throw new HttpError("Load not found", 404);
  }

  const existingAlkTripId = load.trimbleTrip?.alkTripId;
  const existingTmsTripId = load.trimbleTrip?.tmsTripId;

  if (existingAlkTripId && !options.force) {
    if (existingTmsTripId && !isFuelOptimizerTmsTripId(existingTmsTripId)) {
      throw new HttpError(
        `Load ${load.openroadLoadId} is linked to a non-Fuel-Optimizer Trimble trip (${existingTmsTripId}). Refusing to reuse or overwrite it.`,
        409,
      );
    }

    const snapshot = await refreshTripSnapshot(existingAlkTripId);

    if (!isTripDriverUnassigned(snapshot.tspDriverId)) {
      throw new HttpError(
        `Safety stop: Trimble trip ${existingAlkTripId} has tspDriverId=${snapshot.tspDriverId}. Phase 1 refuses to treat assigned trips as ours.`,
        409,
      );
    }

    if (snapshot.tripStatus !== "Planned") {
      throw new HttpError(
        `Safety stop: Trimble trip ${existingAlkTripId} status is ${snapshot.tripStatus}, expected Planned. Phase 1 will not touch non-Planned trips.`,
        409,
      );
    }

    assignTrimbleTripFields(load, {
      alkTripId: String(snapshot.trip.alkTripId ?? existingAlkTripId),
      tmsTripId: existingTmsTripId ?? buildFuelOptimizerTmsTripId(load.openroadLoadId),
      tripStatus: snapshot.tripStatus,
      tspDriverId: null,
      tripDistanceMiles: snapshot.tripDistanceMiles,
      tripDurationMinutes: snapshot.tripDurationMinutes,
      tripUrl: snapshot.tripUrl,
      plannedAt: load.trimbleTrip?.plannedAt ?? new Date(),
      refreshedAt: new Date(),
    });
    await load.save();

    return toTrimbleTripView(load, {
      routePathCoordinateCount: snapshot.routePathCoordinateCount,
      tripUrl: snapshot.tripUrl,
      reusedExisting: true,
      tripStatus: snapshot.tripStatus,
      tspDriverId: null,
      tripDistanceMiles: snapshot.tripDistanceMiles,
      tripDurationMinutes: snapshot.tripDurationMinutes,
    });
  }

  const stops = mapLoadDestinationsToTripStops(load.destinations);
  if (stops.length < 2) {
    throw new HttpError(
      "Load needs at least two geocoded stops (lat/lng) before a Trimble trip can be planned. Sync Open Road TMS first.",
      400,
    );
  }

  const tmsTripId = options.force
    ? `fo-${load.openroadLoadId}-${Date.now()}`
    : buildFuelOptimizerTmsTripId(load.openroadLoadId);

  const planned = await planTrip({
    storeTrip: true,
    tmsTripId,
    name: `Fuel Optimizer load ${load.openroadLoadId}`,
    stops,
    routingType: 0,
  });

  const alkTripId = planned.alkTripId;
  if (alkTripId == null || String(alkTripId).trim() === "") {
    throw new HttpError("Trimble Plan Trip did not return an alkTripId", 502);
  }

  if (!isTripDriverUnassigned(planned.tspDriverId)) {
    throw new HttpError(
      "Safety stop: Plan Trip response included a tspDriverId. Aborting before any further use of this trip.",
      502,
    );
  }

  const tripStatus = normalizeTripStatus(planned.tripStatus);
  if (tripStatus !== "Planned") {
    throw new HttpError(
      `Safety stop: Plan Trip returned status ${tripStatus}. Expected Planned with no tablet assignment.`,
      502,
    );
  }

  const snapshot = await refreshTripSnapshot(String(alkTripId));

  if (!isTripDriverUnassigned(snapshot.tspDriverId)) {
    throw new HttpError(
      `Safety stop: Trimble trip ${alkTripId} has tspDriverId=${snapshot.tspDriverId}. Phase 1 refuses to treat assigned trips as ours.`,
      409,
    );
  }

  if (snapshot.tripStatus !== "Planned") {
    throw new HttpError(
      `Safety stop: Trimble trip ${alkTripId} status is ${snapshot.tripStatus}, expected Planned. Phase 1 will not touch non-Planned trips.`,
      409,
    );
  }

  assignTrimbleTripFields(load, {
    alkTripId: String(alkTripId),
    tmsTripId,
    tripStatus: snapshot.tripStatus,
    tspDriverId: null,
    tripDistanceMiles: snapshot.tripDistanceMiles,
    tripDurationMinutes: snapshot.tripDurationMinutes,
    tripUrl: snapshot.tripUrl,
    plannedAt: new Date(),
    refreshedAt: new Date(),
    stops: stops.map(toTrimbleTripStopRecord),
  });
  await load.save();

  return toTrimbleTripView(load, {
    routePathCoordinateCount: snapshot.routePathCoordinateCount,
    tripUrl: snapshot.tripUrl,
    reusedExisting: false,
    tripStatus: snapshot.tripStatus,
    tspDriverId: null,
    tripDistanceMiles: snapshot.tripDistanceMiles,
    tripDurationMinutes: snapshot.tripDurationMinutes,
  });
}

export async function getTrimbleTripForLoad(loadId: string): Promise<TrimbleTripView> {
  if (!isTripManagementConfigured()) {
    throw new HttpError("Trimble Trip Management is not configured. Set TRIMBLE_API_KEY.", 503);
  }

  const load = await findLoadByIdentifier(loadId);
  if (!load) {
    throw new HttpError("Load not found", 404);
  }

  const alkTripId = load.trimbleTrip?.alkTripId;
  if (!alkTripId) {
    throw new HttpError(
      "No Trimble trip has been planned for this load yet. POST /tms/loads/:loadId/trimble-trip first.",
      404,
    );
  }

  if (load.trimbleTrip?.tmsTripId && !isFuelOptimizerTmsTripId(load.trimbleTrip.tmsTripId)) {
    throw new HttpError(
      `Load is linked to a non-Fuel-Optimizer Trimble trip (${load.trimbleTrip.tmsTripId}). Refusing to read it as ours.`,
      409,
    );
  }

  const snapshot = await refreshTripSnapshot(alkTripId);

  if (snapshot.tripStatus === "Completed" || snapshot.tripStatus === "Canceled") {
    throw new HttpError(
      `Trimble trip ${alkTripId} is ${snapshot.tripStatus} and cannot be read or modified.`,
      409,
    );
  }

  assignTrimbleTripFields(load, {
    alkTripId,
    tmsTripId: load.trimbleTrip?.tmsTripId ?? buildFuelOptimizerTmsTripId(load.openroadLoadId),
    tripStatus: snapshot.tripStatus,
    tspDriverId: snapshot.tspDriverId,
    tripDistanceMiles: snapshot.tripDistanceMiles,
    tripDurationMinutes: snapshot.tripDurationMinutes,
    tripUrl: snapshot.tripUrl,
    plannedAt: load.trimbleTrip?.plannedAt ?? new Date(),
    refreshedAt: new Date(),
  });
  await load.save();

  return toTrimbleTripView(load, {
    routePathCoordinateCount: snapshot.routePathCoordinateCount,
    tripUrl: snapshot.tripUrl,
    reusedExisting: true,
    tripStatus: snapshot.tripStatus,
    tspDriverId: snapshot.tspDriverId,
    tripDistanceMiles: snapshot.tripDistanceMiles,
    tripDurationMinutes: snapshot.tripDurationMinutes,
  });
}

/**
 * Dispatches a Fuel Optimizer trip to one CoPilot tablet (Phase 2 path).
 * Creates a new fo-* trip via Plan Trip with assignTablet + tspDriverId.
 * Prefer dispatchTrimbleTripWithFuelStopForLoad when a fuel stop should be on the trip.
 */
export async function dispatchTrimbleTripForLoad(
  loadId: string,
  options: { tspDriverId?: string; allowTestTablet?: boolean; actor?: FleetScopeActor | null } = {},
): Promise<TrimbleTripView> {
  if (!isTripManagementConfigured()) {
    throw new HttpError("Trimble Trip Management is not configured. Set TRIMBLE_API_KEY.", 503);
  }

  const load = await findLoadByIdentifier(loadId);
  if (!load) {
    throw new HttpError("Load not found", 404);
  }

  await assertActorCanSendLoad(load, options.actor);

  const existingTmsTripId = load.trimbleTrip?.tmsTripId;
  if (existingTmsTripId && !isFuelOptimizerTmsTripId(existingTmsTripId)) {
    throw new HttpError(
      `Load is linked to a non-Fuel-Optimizer Trimble trip (${existingTmsTripId}). Refusing to dispatch.`,
      409,
    );
  }

  let tspDriverId: string | undefined = options.tspDriverId?.trim() || undefined;
  if (!tspDriverId) {
    tspDriverId = (await resolveTspDriverIdFromLoad(load)) || undefined;
  }
  if (!tspDriverId) {
    throw new HttpError(
      "No tspDriverId resolved for this load's truck (FleetVehicle.trimbleAssetId missing).",
      409,
    );
  }

  await assertProductionDispatchAllowed(load, tspDriverId, {
    allowTestTablet: options.allowTestTablet,
  });

  const existingAlkTripId = load.trimbleTrip?.alkTripId;
  if (existingAlkTripId) {
    const snapshot = await refreshTripSnapshot(existingAlkTripId);
    if (
      !isTripDriverUnassigned(snapshot.tspDriverId) &&
      String(snapshot.tspDriverId).trim() === String(tspDriverId).trim() &&
      (snapshot.tripStatus === "Dispatched" ||
        snapshot.tripStatus === "InProgress" ||
        snapshot.tripStatus === "ReceivedByClient")
    ) {
      persistDispatchedSnapshot(load, snapshot, tspDriverId);
      await load.save();
      return toTrimbleTripView(load, {
        routePathCoordinateCount: snapshot.routePathCoordinateCount,
        tripUrl: snapshot.tripUrl,
        reusedExisting: true,
        tripStatus: snapshot.tripStatus,
        tspDriverId,
        tripDistanceMiles: snapshot.tripDistanceMiles,
        tripDurationMinutes: snapshot.tripDurationMinutes,
      });
    }
  }

  const stops =
    load.trimbleTrip?.stops && load.trimbleTrip.stops.length >= 2
      ? recordsToTripManagementStops(load.trimbleTrip.stops)
      : mapLoadDestinationsToTripStops(load.destinations);
  if (stops.length < 2) {
    throw new HttpError(
      "Load needs at least two geocoded stops before a Trimble trip can be dispatched.",
      400,
    );
  }

  const tmsTripId = `fo-${load.openroadLoadId}-${Date.now()}`;
  const planned = await planTrip({
    storeTrip: true,
    tmsTripId,
    name: `Fuel Optimizer load ${load.openroadLoadId} (dispatch)`,
    stops,
    routingType: 0,
    assignTablet: true,
    tspDriverId,
  });

  const alkTripId = planned.alkTripId;
  if (alkTripId == null || String(alkTripId).trim() === "") {
    throw new HttpError("Trimble Plan Trip (dispatch) did not return an alkTripId", 502);
  }

  const finalSnapshot = await refreshTripSnapshot(String(alkTripId));
  const assignedDriver = finalSnapshot.tspDriverId ?? planned.tspDriverId ?? null;

  if (isTripDriverUnassigned(assignedDriver) || String(assignedDriver).trim() !== String(tspDriverId).trim()) {
    throw new HttpError(
      `Dispatch plan returned tspDriverId=${assignedDriver}, expected ${tspDriverId}.`,
      502,
    );
  }

  const acceptedStatuses = new Set(["Dispatched", "Planned", "InProgress", "ReceivedByClient"]);
  if (!acceptedStatuses.has(finalSnapshot.tripStatus)) {
    throw new HttpError(
      `Dispatch plan left trip in unexpected status ${finalSnapshot.tripStatus}.`,
      502,
    );
  }

  assignTrimbleTripFields(load, {
    alkTripId: String(alkTripId),
    tmsTripId,
    tripStatus: finalSnapshot.tripStatus,
    tspDriverId,
    tripDistanceMiles: finalSnapshot.tripDistanceMiles,
    tripDurationMinutes: finalSnapshot.tripDurationMinutes,
    tripUrl: finalSnapshot.tripUrl,
    plannedAt: new Date(),
    refreshedAt: new Date(),
    stops: stops.map(toTrimbleTripStopRecord),
  });
  await load.save();

  return toTrimbleTripView(load, {
    routePathCoordinateCount: finalSnapshot.routePathCoordinateCount,
    tripUrl: finalSnapshot.tripUrl,
    reusedExisting: false,
    tripStatus: finalSnapshot.tripStatus,
    tspDriverId,
    tripDistanceMiles: finalSnapshot.tripDistanceMiles,
    tripDurationMinutes: finalSnapshot.tripDurationMinutes,
  });
}

export async function modifyTrimbleTripForLoad(
  loadId: string,
  options: { stops: TripManagementStopInput[]; tspDriverId?: string },
): Promise<TrimbleTripView> {
  if (!isTripManagementConfigured()) {
    throw new HttpError("Trimble Trip Management is not configured. Set TRIMBLE_API_KEY.", 503);
  }

  const load = await findLoadByIdentifier(loadId);
  if (!load) {
    throw new HttpError("Load not found", 404);
  }

  assertOwnFuelOptimizerTrip(load);

  const alkTripId = load.trimbleTrip?.alkTripId;
  if (!alkTripId) {
    throw new HttpError(
      "No Trimble trip has been planned for this load yet. POST /tms/loads/:loadId/trimble-trip first.",
      404,
    );
  }

  if (!options.stops || options.stops.length < 2) {
    throw new HttpError("modifyTrimbleTripForLoad requires at least two stops.", 400);
  }

  const before = await refreshTripSnapshot(alkTripId);
  if (before.tripStatus === "Completed" || before.tripStatus === "Canceled") {
    throw new HttpError(
      `Trimble trip ${alkTripId} is ${before.tripStatus} and cannot be modified.`,
      409,
    );
  }

  try {
    await modifyTrip({
      alkTripId,
      stops: options.stops,
      tspDriverId: options.tspDriverId,
      routingType: 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new HttpError(`Trimble modify trip failed: ${message}`, 502);
  }

  const snapshot = await refreshTripSnapshot(alkTripId);
  persistTripStopsSnapshot(load, snapshot, {
    stops: options.stops,
    tspDriverId: options.tspDriverId !== undefined ? options.tspDriverId : snapshot.tspDriverId,
  });
  await load.save();

  return toTrimbleTripView(load, {
    routePathCoordinateCount: snapshot.routePathCoordinateCount,
    tripUrl: snapshot.tripUrl,
    reusedExisting: true,
    tripStatus: snapshot.tripStatus,
    tspDriverId: load.trimbleTrip?.tspDriverId ?? null,
    tripDistanceMiles: snapshot.tripDistanceMiles,
    tripDurationMinutes: snapshot.tripDurationMinutes,
  });
}

export async function attachFuelStopToTrimbleTripForLoad(
  loadId: string,
  options: {
    customerSlug?: string;
    relayAccount?: RelayAccount;
    forceNewTrip?: boolean;
    /** Engineering proofs only: force recommendation fuel % for multi-stop chain tests. */
    demo?: boolean;
    demoFuelPercent?: number;
  } = {},
): Promise<TrimbleTripWithFuelView> {
  if (!isTripManagementConfigured()) {
    throw new HttpError("Trimble Trip Management is not configured. Set TRIMBLE_API_KEY.", 503);
  }

  // Prefer reusing a Planned unassigned trip; force a new plan when the existing one is not usable.
  try {
    if (options.forceNewTrip) {
      await planTrimbleTripForLoad(loadId, { force: true });
    } else {
      await planTrimbleTripForLoad(loadId);
    }
  } catch (error) {
    if (options.forceNewTrip) {
      throw error;
    }
    await planTrimbleTripForLoad(loadId, { force: true });
  }

  const load = await findLoadByIdentifier(loadId);
  if (!load) {
    throw new HttpError("Load not found", 404);
  }

  assertOwnFuelOptimizerTrip(load);

  const alkTripId = load.trimbleTrip?.alkTripId;
  if (!alkTripId) {
    throw new HttpError("Plan trip did not persist an alkTripId", 502);
  }

  const snapshotBefore = await refreshTripSnapshot(alkTripId);
  if (snapshotBefore.tripStatus === "Completed" || snapshotBefore.tripStatus === "Canceled") {
    throw new HttpError(
      `Trimble trip ${alkTripId} is ${snapshotBefore.tripStatus} and cannot receive a fuel stop.`,
      409,
    );
  }

  const routePolyline = snapshotBefore.routePolyline;
  const recommendation = await getRecommendationForTruck(String(load.openroadLoadId), {
    customerSlug: options.customerSlug,
    relayAccount: options.relayAccount,
    routePolylineOverride: routePolyline.length >= 2 ? routePolyline : undefined,
    demo: options.demo,
    demoFuelPercent: options.demoFuelPercent,
  });

  const plannedStations = resolvePlannedFuelStations(recommendation.fuelPlan?.stops);
  let stops: TripManagementStopInput[];
  let fuelStopRecords: TrimbleTripFuelStopRecord[] = [];
  let clearFuelStop = false;

  if (recommendation.status === "ready" && plannedStations.length > 0) {
    const built = buildTripStopsWithFuelStops(load.destinations, plannedStations, routePolyline);
    stops = built.stops;
    fuelStopRecords = buildFuelStopRecords(plannedStations, built.fuelStopIndexes);
  } else {
    stops = mapLoadDestinationsToTripStops(load.destinations);
    clearFuelStop = true;
  }

  if (stops.length < 2) {
    throw new HttpError("Load needs at least two geocoded stops before a fuel stop can be attached.", 400);
  }

  await modifyTrip({
    alkTripId,
    stops,
    routingType: 0,
  });

  const snapshot = await refreshTripSnapshot(alkTripId);
  const recommendationMessage = recommendation.fuelPlan?.blockedReason
    ? `${recommendation.message} ${recommendation.fuelPlan.blockedReason}`
    : recommendation.message;
  persistTripStopsSnapshot(load, snapshot, {
    stops,
    fuelStop: fuelStopRecords[0] ?? null,
    fuelStops: fuelStopRecords,
    clearFuelStop,
    recommendationStatus: recommendation.status,
    recommendationMessage,
    tspDriverId: snapshot.tspDriverId,
  });
  await load.save();

  const view = toTrimbleTripView(load, {
    routePathCoordinateCount: snapshot.routePathCoordinateCount,
    tripUrl: snapshot.tripUrl,
    reusedExisting: true,
    tripStatus: snapshot.tripStatus,
    tspDriverId: snapshot.tspDriverId,
    tripDistanceMiles: snapshot.tripDistanceMiles,
    tripDurationMinutes: snapshot.tripDurationMinutes,
  });

  return {
    ...view,
    recommendation: {
      status: recommendation.status,
      message: recommendationMessage,
    },
  };
}

export async function dispatchTrimbleTripWithFuelStopForLoad(
  loadId: string,
  options: {
    tspDriverId?: string;
    allowTestTablet?: boolean;
    customerSlug?: string;
    relayAccount?: RelayAccount;
    /** Fall back to Phase 2 re-plan dispatch if modify+tspDriverId fails. */
    useReplanDispatch?: boolean;
    actor?: FleetScopeActor | null;
    demo?: boolean;
    demoFuelPercent?: number;
  } = {},
): Promise<TrimbleTripWithFuelView> {
  const loadForScope = await findLoadByIdentifier(loadId);
  if (!loadForScope) {
    throw new HttpError("Load not found", 404);
  }
  await assertActorCanSendLoad(loadForScope, options.actor);

  const attached = await attachFuelStopToTrimbleTripForLoad(loadId, {
    customerSlug: options.customerSlug,
    demo: options.demo,
    demoFuelPercent: options.demoFuelPercent,
    relayAccount: options.relayAccount,
  });

  const load = await findLoadByIdentifier(loadId);
  if (!load) {
    throw new HttpError("Load not found", 404);
  }

  assertOwnFuelOptimizerTrip(load);

  let tspDriverId: string | undefined = options.tspDriverId?.trim() || undefined;
  if (!tspDriverId) {
    tspDriverId = (await resolveTspDriverIdFromLoad(load)) || undefined;
  }
  if (!tspDriverId) {
    throw new HttpError(
      "No tspDriverId resolved for this load's truck (FleetVehicle.trimbleAssetId missing).",
      409,
    );
  }

  await assertProductionDispatchAllowed(load, tspDriverId, {
    allowTestTablet: options.allowTestTablet,
  });

  const alkTripId = load.trimbleTrip?.alkTripId;
  if (!alkTripId) {
    throw new HttpError("No alkTripId after attaching fuel stop", 502);
  }

  const stops =
    load.trimbleTrip?.stops && load.trimbleTrip.stops.length >= 2
      ? recordsToTripManagementStops(load.trimbleTrip.stops)
      : mapLoadDestinationsToTripStops(load.destinations);

  if (stops.length < 2) {
    throw new HttpError("Cannot dispatch without at least two stops.", 400);
  }

  const before = await refreshTripSnapshot(alkTripId);
  if (
    !isTripDriverUnassigned(before.tspDriverId) &&
    String(before.tspDriverId).trim() === String(tspDriverId).trim() &&
    (before.tripStatus === "Dispatched" ||
      before.tripStatus === "InProgress" ||
      before.tripStatus === "ReceivedByClient")
  ) {
    persistDispatchedSnapshot(load, before, tspDriverId);
    await load.save();
    return {
      ...toTrimbleTripView(load, {
        routePathCoordinateCount: before.routePathCoordinateCount,
        tripUrl: before.tripUrl,
        reusedExisting: true,
        tripStatus: before.tripStatus,
        tspDriverId,
        tripDistanceMiles: before.tripDistanceMiles,
        tripDurationMinutes: before.tripDurationMinutes,
      }),
      recommendation: attached.recommendation,
    };
  }

  try {
    await modifyTrip({
      alkTripId,
      stops,
      tspDriverId,
      routingType: 0,
    });
  } catch (error) {
    if (options.useReplanDispatch) {
      const fallback = await dispatchTrimbleTripForLoad(loadId, {
        tspDriverId,
        allowTestTablet: options.allowTestTablet,
        actor: options.actor,
      });
      return {
        ...fallback,
        recommendation: attached.recommendation,
      };
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new HttpError(`Modify-dispatch with fuel stop failed: ${message}`, 502);
  }

  const snapshot = await refreshTripSnapshot(alkTripId);
  persistTripStopsSnapshot(load, snapshot, {
    stops,
    tspDriverId,
    recommendationStatus: attached.recommendation.status,
    recommendationMessage: attached.recommendation.message,
  });
  await load.save();

  return {
    ...toTrimbleTripView(load, {
      routePathCoordinateCount: snapshot.routePathCoordinateCount,
      tripUrl: snapshot.tripUrl,
      reusedExisting: true,
      tripStatus: snapshot.tripStatus,
      tspDriverId,
      tripDistanceMiles: snapshot.tripDistanceMiles,
      tripDurationMinutes: snapshot.tripDurationMinutes,
    }),
    recommendation: attached.recommendation,
  };
}

function isCompletedTrimbleStop(stop: {
  stopStatus?: string | number | boolean | null;
  arrived?: boolean;
  completed?: boolean;
}) {
  if (stop.completed === true || stop.arrived === true) return true;
  const status = String(stop.stopStatus ?? "").toLowerCase();
  return status === "completed" || status === "arrived" || status === "3" || status === "done";
}

function mapTrimbleResponseStopsToInput(
  tripStops: Array<{
    stopType?: string;
    stopStatus?: string | number | boolean | null;
    arrived?: boolean;
    completed?: boolean;
    location?: { label?: string; coords?: { lat?: string | number; lon?: string | number } };
  }>,
): TripManagementStopInput[] {
  const mapped: TripManagementStopInput[] = [];
  for (const stop of tripStops) {
    if (isCompletedTrimbleStop(stop)) continue;
    const lat = Number(stop.location?.coords?.lat);
    const lon = Number(stop.location?.coords?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const stopType = (stop.stopType || "Work") as TripManagementStopInput["stopType"];
    if (stopType === "FuelStop") continue;
    mapped.push({
      stopType,
      lat,
      lon,
      label: stop.location?.label,
    });
  }
  return mapped;
}

export async function updateFuelStopOnInProgressTripForLoad(
  loadId: string,
  options: { customerSlug?: string; relayAccount?: RelayAccount } = {},
): Promise<TrimbleTripWithFuelView> {
  if (!isTripManagementConfigured()) {
    throw new HttpError("Trimble Trip Management is not configured. Set TRIMBLE_API_KEY.", 503);
  }

  const load = await findLoadByIdentifier(loadId);
  if (!load) {
    throw new HttpError("Load not found", 404);
  }

  assertOwnFuelOptimizerTrip(load);

  const alkTripId = load.trimbleTrip?.alkTripId;
  if (!alkTripId) {
    throw new HttpError("No Trimble trip on this load to update.", 404);
  }

  const snapshotBefore = await refreshTripSnapshot(alkTripId);
  if (snapshotBefore.tripStatus !== "Dispatched" && snapshotBefore.tripStatus !== "InProgress") {
    throw new HttpError(
      `In-trip fuel stop update requires Dispatched or InProgress status, got ${snapshotBefore.tripStatus}.`,
      409,
    );
  }

  const routePolyline = snapshotBefore.routePolyline;
  const recommendation = await getRecommendationForTruck(String(load.openroadLoadId), {
    customerSlug: options.customerSlug,
    relayAccount: options.relayAccount,
    routePolylineOverride: routePolyline.length >= 2 ? routePolyline : undefined,
  });

  const openStopsFromTrip = mapTrimbleResponseStopsToInput(snapshotBefore.trip.stops ?? []);
  const baseStops =
    openStopsFromTrip.length >= 1
      ? openStopsFromTrip
      : mapLoadDestinationsToTripStops(load.destinations.filter((destination) => !destination.completed));

  if (baseStops.length < 1) {
    throw new HttpError("No open stops remain on this trip to update.", 409);
  }

  const plannedStations = resolvePlannedFuelStations(recommendation.fuelPlan?.stops);
  let stops: TripManagementStopInput[];
  let fuelStopRecords: TrimbleTripFuelStopRecord[] = [];
  let clearFuelStop = false;

  if (recommendation.status === "ready" && plannedStations.length > 0) {
    const built = replaceOpenFuelStops(baseStops, plannedStations, routePolyline);
    stops = built.stops;
    fuelStopRecords = buildFuelStopRecords(plannedStations, built.fuelStopIndexes);
  } else {
    stops = baseStops.filter((stop) => stop.stopType !== "FuelStop");
    clearFuelStop = true;
  }

  try {
    await modifyTrip({
      alkTripId,
      stops,
      routingType: 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new HttpError(`In-trip fuel stop update failed: ${message}`, 502);
  }

  const snapshot = await refreshTripSnapshot(alkTripId);
  const recommendationMessage = recommendation.fuelPlan?.blockedReason
    ? `${recommendation.message} ${recommendation.fuelPlan.blockedReason}`
    : recommendation.message;
  persistTripStopsSnapshot(load, snapshot, {
    stops,
    fuelStop: fuelStopRecords[0] ?? null,
    fuelStops: fuelStopRecords,
    clearFuelStop,
    recommendationStatus: recommendation.status,
    recommendationMessage,
    tspDriverId: snapshot.tspDriverId,
  });
  await load.save();

  return {
    ...toTrimbleTripView(load, {
      routePathCoordinateCount: snapshot.routePathCoordinateCount,
      tripUrl: snapshot.tripUrl,
      reusedExisting: true,
      tripStatus: snapshot.tripStatus,
      tspDriverId: snapshot.tspDriverId,
      tripDistanceMiles: snapshot.tripDistanceMiles,
      tripDurationMinutes: snapshot.tripDurationMinutes,
    }),
    recommendation: {
      status: recommendation.status,
      message: recommendationMessage,
    },
  };
}

export async function getTrimbleTripRoutePathForLoad(loadId: string): Promise<{
  openroadLoadId: number;
  alkTripId: string;
  polyline: GeoPoint[];
  coordinateCount: number;
}> {
  if (!isTripManagementConfigured()) {
    throw new HttpError("Trimble Trip Management is not configured. Set TRIMBLE_API_KEY.", 503);
  }

  const load = await findLoadByIdentifier(loadId);
  if (!load) {
    throw new HttpError("Load not found", 404);
  }

  assertOwnFuelOptimizerTrip(load);

  const alkTripId = load.trimbleTrip?.alkTripId;
  if (!alkTripId) {
    throw new HttpError("No Trimble trip has been planned for this load yet.", 404);
  }

  const routePath = await getTripRoutePath(alkTripId);
  const polyline = extractRoutePathPolyline(routePath);

  return {
    openroadLoadId: load.openroadLoadId,
    alkTripId,
    polyline,
    coordinateCount: polyline.length,
  };
}
