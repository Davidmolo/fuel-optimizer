import {
  isFuelOptimizerTmsTripId,
  normalizeTripStatus,
  type TripManagementStopResponse,
  type TripManagementTripResponse,
} from "../../../integrations/trip-management";
import { haversineDistanceMiles, type GeoPoint } from "../../../utils/geo";

/** Pickup and delivery must each sit within this distance of a stop on the tablet trip. */
export const TABLET_TRIP_MATCH_MILES = 2;

const ACTIVE_TABLET_STATUSES = ["InProgress", "Dispatched", "ReceivedByClient"] as const;

const ACTIVE_STATUS_RANK: Record<(typeof ACTIVE_TABLET_STATUSES)[number], number> = {
  InProgress: 0,
  Dispatched: 1,
  ReceivedByClient: 2,
};

export type TabletTripStop = {
  lat: number;
  lon: number;
  stopType?: string;
  label?: string;
};

export type TabletTripCandidate = {
  alkTripId: string;
  tmsTripId: string | null;
  tripStatus: string;
  tspDriverId: string | null;
  stops: TabletTripStop[];
};

export type LoadStopPoint = {
  lat?: number | null;
  lng?: number | null;
};

export function isActiveTabletTripStatus(tripStatus: string) {
  return (ACTIVE_TABLET_STATUSES as readonly string[]).includes(tripStatus);
}

export function toTabletTripCandidate(trip: TripManagementTripResponse): TabletTripCandidate | null {
  if (trip.alkTripId == null || String(trip.alkTripId).trim() === "") {
    return null;
  }

  return {
    alkTripId: String(trip.alkTripId),
    tmsTripId: trip.tmsTripId?.trim() || null,
    tripStatus: normalizeTripStatus(trip.tripStatus),
    tspDriverId: trip.tspDriverId?.trim() || null,
    stops: stopsFromTripResponse(trip.stops),
  };
}

export function stopsFromTripResponse(stops: TripManagementStopResponse[] | undefined): TabletTripStop[] {
  const mapped: TabletTripStop[] = [];
  for (const stop of stops ?? []) {
    const lat = Number(stop.location?.coords?.lat);
    const lon = Number(stop.location?.coords?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      continue;
    }
    mapped.push({
      lat,
      lon,
      stopType: stop.stopType,
      label: stop.location?.label,
    });
  }
  return mapped;
}

function geocodedLoadEnds(destinations: LoadStopPoint[]): { pickup: GeoPoint; delivery: GeoPoint } | null {
  const points: GeoPoint[] = [];
  for (const destination of destinations) {
    if (typeof destination.lat !== "number" || typeof destination.lng !== "number") {
      continue;
    }
    if (!Number.isFinite(destination.lat) || !Number.isFinite(destination.lng)) {
      continue;
    }
    points.push({ lat: destination.lat, lng: destination.lng });
  }

  const pickup = points[0];
  const delivery = points[points.length - 1];
  if (!pickup || !delivery || points.length < 2) {
    return null;
  }

  return { pickup, delivery };
}

function nearestStopMiles(point: GeoPoint, stops: TabletTripStop[]) {
  let nearest = Number.POSITIVE_INFINITY;
  for (const stop of stops) {
    const distance = haversineDistanceMiles(point, { lat: stop.lat, lng: stop.lon });
    if (distance < nearest) {
      nearest = distance;
    }
  }
  return nearest;
}

/** True when this load's pickup and delivery both sit on the tablet trip, regardless of stop type. */
export function tripMatchesLoad(
  destinations: LoadStopPoint[],
  stops: TabletTripStop[],
  maxMiles = TABLET_TRIP_MATCH_MILES,
) {
  const ends = geocodedLoadEnds(destinations);
  if (!ends || stops.length === 0) {
    return false;
  }

  return (
    nearestStopMiles(ends.pickup, stops) <= maxMiles && nearestStopMiles(ends.delivery, stops) <= maxMiles
  );
}

function matchDistance(destinations: LoadStopPoint[], stops: TabletTripStop[]) {
  const ends = geocodedLoadEnds(destinations);
  if (!ends) {
    return Number.POSITIVE_INFINITY;
  }
  return nearestStopMiles(ends.pickup, stops) + nearestStopMiles(ends.delivery, stops);
}

/**
 * Active trip on this tablet whose stops match the load.
 * InProgress wins over Dispatched and ReceivedByClient. Planned trips are ignored.
 */
export function pickActiveTabletTrip(
  candidates: TabletTripCandidate[],
  destinations: LoadStopPoint[],
): TabletTripCandidate | null {
  const matches = candidates.filter(
    (candidate) => isActiveTabletTripStatus(candidate.tripStatus) && tripMatchesLoad(destinations, candidate.stops),
  );

  matches.sort((left, right) => {
    const leftRank = ACTIVE_STATUS_RANK[left.tripStatus as keyof typeof ACTIVE_STATUS_RANK] ?? 99;
    const rightRank = ACTIVE_STATUS_RANK[right.tripStatus as keyof typeof ACTIVE_STATUS_RANK] ?? 99;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return matchDistance(destinations, left.stops) - matchDistance(destinations, right.stops);
  });

  return matches[0] ?? null;
}

export function resolveCopilotSendPlan(match: TabletTripCandidate | null):
  | { action: "update-existing"; alkTripId: string }
  | { action: "create-new" } {
  if (match) {
    return { action: "update-existing", alkTripId: match.alkTripId };
  }
  return { action: "create-new" };
}

export type OwnedTripUpdateCandidate = {
  alkTripId?: string | null;
  tmsTripId?: string | null;
  tripStatus?: string | null;
};

export type InProgressFuelUpdateTarget =
  | { action: "update"; alkTripId: string }
  | { action: "confirm-owned"; alkTripId: string }
  | { action: "refuse"; reason: string };

const CONFIRMABLE_OWNED_STATUSES = new Set(["Dispatched", "InProgress", "ReceivedByClient"]);

/**
 * Fuel-stop updates go to the trip the tablet is already driving.
 * A stored status is not enough to edit a trip. Search must find it, or a live
 * Trimble read must still show that trip active and on this load.
 * A Planned Fuel Optimizer copy is never edited in its place, and no second trip is created.
 */
export function resolveInProgressFuelUpdateTarget(input: {
  activeTabletTrip: Pick<TabletTripCandidate, "alkTripId"> | null;
  ownedTrip?: OwnedTripUpdateCandidate | null;
}): InProgressFuelUpdateTarget {
  if (input.activeTabletTrip) {
    return { action: "update", alkTripId: input.activeTabletTrip.alkTripId };
  }

  const owned = input.ownedTrip;
  const alkTripId = owned?.alkTripId?.trim() ?? "";
  const tripStatus = owned?.tripStatus ?? "";
  if (alkTripId && CONFIRMABLE_OWNED_STATUSES.has(tripStatus)) {
    return { action: "confirm-owned", alkTripId };
  }

  if (alkTripId && isFuelOptimizerTmsTripId(owned?.tmsTripId) && tripStatus === "Planned") {
    return {
      action: "refuse",
      reason:
        "The Fuel Optimizer trip is still Planned and the tablet is not driving it, so fuel stops were not changed and a second trip was not created.",
    };
  }

  return {
    action: "refuse",
    reason:
      "No in-progress trip for this load is on the tablet, so fuel stops were not changed and a second trip was not created.",
  };
}

export type OwnedTripConfirmation = { action: "confirmed" } | { action: "refuse"; reason: string };

/** Live Trimble read of a stored trip. Edit it only while it is active and still this load. */
export function confirmOwnedTripForFuelUpdate(input: {
  tripStatus: string;
  stops: TabletTripStop[];
  destinations: LoadStopPoint[];
}): OwnedTripConfirmation {
  if (!isActiveTabletTripStatus(input.tripStatus)) {
    return {
      action: "refuse",
      reason: `The stored trip is ${input.tripStatus}, so fuel stops were not changed and a second trip was not created.`,
    };
  }

  if (!tripMatchesLoad(input.destinations, input.stops)) {
    return {
      action: "refuse",
      reason:
        "The stored trip is not the route on this load, so fuel stops were not changed and a second trip was not created.",
    };
  }

  return { action: "confirmed" };
}
