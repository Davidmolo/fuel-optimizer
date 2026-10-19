import type { TripManagementStopResponse } from "../../../integrations/trip-management";
import { haversineDistanceMiles } from "../../../utils/geo";
import type { TrimbleTripFuelStopRecord } from "../models/tms-load.model";

/** Max distance (miles) to treat a Trimble response FuelStop as the same planned stop. */
export const FUEL_STOP_STATUS_MATCH_MILES = 0.5;

function stopNearPoint(
  point: { lat: number; lon: number },
  tripStops: TripManagementStopResponse[] | undefined,
) {
  return (tripStops ?? []).some((candidate) => {
    const coords = responseStopCoords(candidate);
    if (!coords) {
      return false;
    }
    return haversineDistanceMiles({ lat: point.lat, lng: point.lon }, coords) <= FUEL_STOP_STATUS_MATCH_MILES;
  });
}

export type FuelStopUpdateAssessment = {
  landed: boolean;
  message: string;
};

/**
 * Compares the stop list we sent with the trip Trimble returned after modify.
 * A sent fuel stop counts when any returned stop sits on those coordinates, even if
 * Trimble did not keep the FuelStop type. Sending none is complete only when no FuelStop remains.
 */
export function assessFuelStopUpdate(
  sentStops: Array<{ stopType?: string; lat: number; lon: number }>,
  tripStops: TripManagementStopResponse[] | undefined,
): FuelStopUpdateAssessment {
  const expected = sentStops.filter((stop) => isFuelStopType(stop.stopType));
  const returnedFuelStops = (tripStops ?? []).filter((stop) => isFuelStopType(stop.stopType));

  if (expected.length === 0) {
    if (returnedFuelStops.length === 0) {
      return { landed: true, message: "" };
    }
    return {
      landed: false,
      message: "Trimble updated the trip, but a fuel stop is still on it.",
    };
  }

  const missing = expected.filter((stop) => !stopNearPoint(stop, tripStops));
  if (missing.length === 0) {
    return { landed: true, message: "" };
  }

  return {
    landed: false,
    message: "Trimble updated the trip, but the fuel stop is not on the trip it returned.",
  };
}

/** True when every FuelStop we sent is present on the trip Trimble returned. */
export function fuelStopsLandedOnTrip(
  sentStops: Array<{ stopType?: string; lat: number; lon: number }>,
  tripStops: TripManagementStopResponse[] | undefined,
): boolean {
  return assessFuelStopUpdate(sentStops, tripStops).landed;
}

export function fuelStopCoordinateLanded(
  point: { lat: number; lon: number },
  tripStops: TripManagementStopResponse[] | undefined,
) {
  return stopNearPoint(point, tripStops);
}

export function isTrimbleFuelStopArrived(stop: {
  stopStatus?: string | number | boolean | null;
  arrived?: boolean;
  completed?: boolean;
}) {
  if (stop.completed === true || stop.arrived === true) {
    return true;
  }
  const status = String(stop.stopStatus ?? "").toLowerCase();
  return status === "completed" || status === "arrived" || status === "3" || status === "done";
}

function isFuelStopType(stopType?: string) {
  return String(stopType ?? "").toLowerCase() === "fuelstop";
}

function responseStopCoords(stop: TripManagementStopResponse) {
  const lat = Number(stop.location?.coords?.lat);
  const lon = Number(stop.location?.coords?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }
  return { lat, lng: lon };
}

/**
 * Sticky-merge Trimble trip response FuelStop arrival/completion onto planned fuelStops.
 * Once arrived/completed is true, it is never cleared.
 */
export function mergeFuelStopStatusFromTripResponse(
  fuelStops: TrimbleTripFuelStopRecord[],
  tripStops: TripManagementStopResponse[] | undefined,
  observedAt: Date,
): TrimbleTripFuelStopRecord[] {
  if (!fuelStops.length) {
    return fuelStops;
  }

  const responseFuelStops = (tripStops ?? []).filter((stop) => isFuelStopType(stop.stopType));
  const usedResponseIndexes = new Set<number>();

  return fuelStops.map((planned, plannedIndex) => {
    let matchIndex = responseFuelStops.findIndex((stop, index) => {
      if (usedResponseIndexes.has(index)) {
        return false;
      }
      const coords = responseStopCoords(stop);
      if (!coords) {
        return false;
      }
      return (
        haversineDistanceMiles(
          { lat: planned.latitude, lng: planned.longitude },
          coords,
        ) <= FUEL_STOP_STATUS_MATCH_MILES
      );
    });

    if (matchIndex < 0 && plannedIndex < responseFuelStops.length && !usedResponseIndexes.has(plannedIndex)) {
      matchIndex = plannedIndex;
    }

    if (matchIndex < 0) {
      return planned;
    }

    usedResponseIndexes.add(matchIndex);
    const responseStop = responseFuelStops[matchIndex]!;
    const arrivedNow = isTrimbleFuelStopArrived(responseStop);
    const completedNow = responseStop.completed === true || String(responseStop.stopStatus ?? "").toLowerCase() === "completed";
    const arrived = planned.arrived === true || arrivedNow;
    const completed = planned.completed === true || completedNow;
    const stopStatus =
      responseStop.stopStatus !== undefined && responseStop.stopStatus !== null
        ? String(responseStop.stopStatus)
        : planned.stopStatus;

    return {
      ...planned,
      arrived,
      completed,
      stopStatus,
      statusObservedAt:
        arrived || completed ? (planned.statusObservedAt ?? observedAt) : planned.statusObservedAt,
    };
  });
}

export function withStickyGpsNearAt(
  stop: TrimbleTripFuelStopRecord,
  nearAt: Date,
): TrimbleTripFuelStopRecord {
  if (stop.gpsNearAt) {
    return stop;
  }
  return {
    ...stop,
    gpsNearAt: nearAt,
  };
}

/** Carry sticky arrival / GPS evidence onto a replacement fuel-stop chain by location. */
export function carryStickyFuelStopEvidence(
  previous: TrimbleTripFuelStopRecord[] | undefined,
  next: TrimbleTripFuelStopRecord[],
): TrimbleTripFuelStopRecord[] {
  if (!previous?.length || !next.length) {
    return next;
  }

  return next.map((stop) => {
    const prior = previous.find(
      (candidate) =>
        candidate.relayAccount === stop.relayAccount &&
        candidate.relayLocationId === stop.relayLocationId,
    );
    if (!prior) {
      return stop;
    }

    return {
      ...stop,
      arrived: stop.arrived === true || prior.arrived === true,
      completed: stop.completed === true || prior.completed === true,
      stopStatus: stop.stopStatus ?? prior.stopStatus,
      statusObservedAt: stop.statusObservedAt ?? prior.statusObservedAt,
      gpsNearAt: stop.gpsNearAt ?? prior.gpsNearAt,
    };
  });
}
