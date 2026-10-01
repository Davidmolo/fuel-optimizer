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
import { FleetVehicleModel } from "../../fleet/models/fleet-vehicle.model";
import { isTestCopilotAssetId } from "../../fleet/services/copilot-asset-matching";
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
    notifiesTablet: boolean;
    tspDriverIdAssigned: boolean;
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
    tripStatus,
    tspDriverId,
    tripDistanceMiles: trip.tripDistance,
    tripDurationMinutes: trip.tripDriveDuration ?? trip.tripDuration,
    tripUrl: trip.url,
    routePathCoordinateCount: countRoutePathCoordinates(routePath),
  };
}

async function resolveTspDriverIdFromLoad(load: TmsLoadDocument): Promise<string | null> {
  const unit = load.truckUnit?.trim();
  if (!unit) return null;
  const vehicle = await FleetVehicleModel.findOne({ unitNumber: unit, isActive: true });
  return vehicle?.trimbleAssetId?.trim() || null;
}

function persistDispatchedSnapshot(
  load: TmsLoadDocument,
  snapshot: Awaited<ReturnType<typeof refreshTripSnapshot>>,
  tspDriverId: string,
) {
  load.trimbleTrip = {
    alkTripId: String(snapshot.trip.alkTripId ?? load.trimbleTrip!.alkTripId),
    tmsTripId: load.trimbleTrip?.tmsTripId ?? buildFuelOptimizerTmsTripId(load.openroadLoadId),
    tripStatus: snapshot.tripStatus,
    tspDriverId,
    tripDistanceMiles: snapshot.tripDistanceMiles,
    tripDurationMinutes: snapshot.tripDurationMinutes,
    tripUrl: snapshot.tripUrl,
    plannedAt: load.trimbleTrip?.plannedAt ?? new Date(),
    refreshedAt: new Date(),
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

  if (snapshot.tripStatus === "Completed" || snapshot.tripStatus === "Canceled") {
    throw new HttpError(
      `Trimble trip ${alkTripId} is ${snapshot.tripStatus} and cannot be read or modified.`,
      409,
    );
  }

  load.trimbleTrip = {
    alkTripId,
    tmsTripId: load.trimbleTrip?.tmsTripId ?? buildFuelOptimizerTmsTripId(load.openroadLoadId),
    tripStatus: snapshot.tripStatus,
    tspDriverId: snapshot.tspDriverId,
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
    tspDriverId: snapshot.tspDriverId,
    tripDistanceMiles: snapshot.tripDistanceMiles,
    tripDurationMinutes: snapshot.tripDurationMinutes,
  });
}

/**
 * Dispatches a Fuel Optimizer trip to one CoPilot tablet.
 * Trimble docs: Dispatched is triggered when a trip is *created* with tspDriverId and CoPilot is connected.
 * Live spike: modify-only assignment set tspDriverId but left status Planned and no tablet popup.
 * So dispatch creates a new fo-* trip via Plan Trip with assignTablet + tspDriverId.
 * Engineering tests may use tablet 999 with allowTestTablet=true.
 * Production dispatch resolves tspDriverId from FleetVehicle.trimbleAssetId and rejects 999.
 */
export async function dispatchTrimbleTripForLoad(
  loadId: string,
  options: { tspDriverId?: string; allowTestTablet?: boolean } = {},
): Promise<TrimbleTripView> {
  if (!isTripManagementConfigured()) {
    throw new HttpError("Trimble Trip Management is not configured. Set TRIMBLE_API_KEY.", 503);
  }

  const load = await findLoadByIdentifier(loadId);
  if (!load) {
    throw new HttpError("Load not found", 404);
  }

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

  if (isTestCopilotAssetId(tspDriverId) && !options.allowTestTablet) {
    throw new HttpError(
      `Refusing to dispatch to test tablet ${tspDriverId} without allowTestTablet=true. Production dispatch must not target 999.`,
      409,
    );
  }

  const existingAlkTripId = load.trimbleTrip?.alkTripId;
  if (existingAlkTripId) {
    const snapshot = await refreshTripSnapshot(existingAlkTripId);
    // Idempotent only when Trimble already flipped past Planned (popup path actually engaged).
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

  const stops = mapLoadDestinationsToTripStops(load.destinations);
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

  load.trimbleTrip = {
    alkTripId: String(alkTripId),
    tmsTripId,
    tripStatus: finalSnapshot.tripStatus,
    tspDriverId,
    tripDistanceMiles: finalSnapshot.tripDistanceMiles,
    tripDurationMinutes: finalSnapshot.tripDurationMinutes,
    tripUrl: finalSnapshot.tripUrl,
    plannedAt: new Date(),
    refreshedAt: new Date(),
  };
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
