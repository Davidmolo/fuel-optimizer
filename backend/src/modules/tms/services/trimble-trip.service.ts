import { isValidObjectId } from "mongoose";
import {
  buildFuelOptimizerTmsTripId,
  countRoutePathCoordinates,
  getTripByAlkTripId,
  getTripRoutePath,
  isFuelOptimizerTmsTripId,
  isTripDriverUnassigned,
  isTripManagementConfigured,
  normalizeTripStatus,
  planTrip,
} from "../../../integrations/trip-management";
import { HttpError } from "../../../utils/http-error";
import { TmsLoadModel, type TmsLoadDocument } from "../models/tms-load.model";
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
  safety: {
    notifiesTablet: false;
    tspDriverIdAssigned: false;
    ownsTrip: boolean;
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
    safety: {
      notifiesTablet: false,
      tspDriverIdAssigned: false,
      ownsTrip: isFuelOptimizerTmsTripId(tmsTripId),
    },
  };
}

async function refreshTripSnapshot(alkTripId: string) {
  const [trip, routePath] = await Promise.all([getTripByAlkTripId(alkTripId), getTripRoutePath(alkTripId)]);

  const tripStatus = normalizeTripStatus(trip.tripStatus);
  const tspDriverId = trip.tspDriverId ?? null;

  if (!isTripDriverUnassigned(tspDriverId)) {
    throw new HttpError(
      `Safety stop: Trimble trip ${alkTripId} has tspDriverId=${tspDriverId}. Phase 1 refuses to treat assigned trips as ours.`,
      409,
    );
  }

  if (tripStatus !== "Planned") {
    throw new HttpError(
      `Safety stop: Trimble trip ${alkTripId} status is ${tripStatus}, expected Planned. Phase 1 will not touch non-Planned trips.`,
      409,
    );
  }

  return {
    trip,
    tripStatus,
    tspDriverId,
    tripDistanceMiles: trip.tripDistance,
    tripDurationMinutes: trip.tripDriveDuration ?? trip.tripDuration,
    tripUrl: trip.url,
    routePathCoordinateCount: countRoutePathCoordinates(routePath),
  };
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
    load.trimbleTrip = {
      alkTripId: String(snapshot.trip.alkTripId ?? existingAlkTripId),
      tmsTripId: existingTmsTripId ?? buildFuelOptimizerTmsTripId(load.openroadLoadId),
      tripStatus: snapshot.tripStatus,
      tspDriverId: null,
      tripDistanceMiles: snapshot.tripDistanceMiles,
      tripDurationMinutes: snapshot.tripDurationMinutes,
      tripUrl: snapshot.tripUrl,
      plannedAt: load.trimbleTrip?.plannedAt ?? new Date(),
      refreshedAt: new Date(),
    };
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

  load.trimbleTrip = {
    alkTripId: String(alkTripId),
    tmsTripId,
    tripStatus: snapshot.tripStatus,
    tspDriverId: null,
    tripDistanceMiles: snapshot.tripDistanceMiles,
    tripDurationMinutes: snapshot.tripDurationMinutes,
    tripUrl: snapshot.tripUrl,
    plannedAt: new Date(),
    refreshedAt: new Date(),
  };
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
  load.trimbleTrip = {
    alkTripId,
    tmsTripId: load.trimbleTrip?.tmsTripId ?? buildFuelOptimizerTmsTripId(load.openroadLoadId),
    tripStatus: snapshot.tripStatus,
    tspDriverId: null,
    tripDistanceMiles: snapshot.tripDistanceMiles,
    tripDurationMinutes: snapshot.tripDurationMinutes,
    tripUrl: snapshot.tripUrl,
    plannedAt: load.trimbleTrip?.plannedAt ?? new Date(),
    refreshedAt: new Date(),
  };
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
