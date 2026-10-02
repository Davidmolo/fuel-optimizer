import { DEFAULT_ROUTING_PROFILE_NAME } from "./trip-management.config";
import type { TripManagementPlanTripRequest } from "./trip-management.types";

function formatCoordinate(value: number) {
  return value.toFixed(6);
}

/**
 * Builds the routingProfile object for Plan/Modify Trip.
 * Always includes the company profile `name` so CoPilot can auto-select it
 * and skip the on-tablet "Use Profile" prompt.
 */
export function buildRoutingProfile(input?: {
  routingType?: 0 | 1 | 2;
  routingProfileName?: string;
}) {
  const name = input?.routingProfileName?.trim() || DEFAULT_ROUTING_PROFILE_NAME;
  return {
    name,
    routingType: input?.routingType ?? 0,
  };
}

/**
 * Applies optional Trimble identity fields (tspId, tmsCustomerId, tmsId, tmsUserId)
 * to a Plan/Modify body. These are usually resolved from the API key by Trimble,
 * but can be supplied explicitly when dispatch to CoPilot does not engage.
 */
export function applyTripManagementIdentity(
  body: Record<string, unknown>,
  identity: {
    tspId?: string;
    tmsCustomerId?: string;
    tmsId?: 0 | 1 | 2;
    tmsUserId?: string;
  },
) {
  if (identity.tspId) body.tspId = identity.tspId;
  if (identity.tmsCustomerId) body.tmsCustomerId = identity.tmsCustomerId;
  if (identity.tmsId != null) body.tmsId = identity.tmsId;
  if (identity.tmsUserId) body.tmsUserId = identity.tmsUserId;
}

/**
 * Builds a Plan Trip body.
 * Phase 1 (assignTablet false/omitted): omits tspDriverId so Trimble creates Planned only.
 * Phase 2 dispatch (assignTablet true): includes tspDriverId so Trimble can notify the tablet.
 * Trimble docs: Dispatched is triggered when a trip is created with tspDriverId and CoPilot is connected.
 */
export function buildPlanTripBody(input: TripManagementPlanTripRequest) {
  if (input.stops.length < 2) {
    throw new Error("At least two geocoded stops are required to plan a trip");
  }

  const body: Record<string, unknown> = {
    storeTrip: input.storeTrip ?? true,
    stops: input.stops.map((stop) => ({
      stopType: stop.stopType,
      location: {
        coords: {
          lat: formatCoordinate(stop.lat),
          lon: formatCoordinate(stop.lon),
        },
        ...(stop.label ? { label: stop.label } : {}),
      },
    })),
    routingProfile: buildRoutingProfile({
      routingType: input.routingType,
      routingProfileName: input.routingProfileName,
    }),
  };

  if (input.tmsTripId) {
    body.tmsTripId = input.tmsTripId;
  }

  if (input.name) {
    body.name = input.name;
  }

  applyTripManagementIdentity(body, {
    tspId: input.tspId,
    tmsCustomerId: input.tmsCustomerId,
    tmsId: input.tmsId,
    tmsUserId: input.tmsUserId,
  });

  const tspDriverId = input.tspDriverId?.trim();
  if (input.assignTablet && tspDriverId) {
    body.tspDriverId = tspDriverId;
  } else if ("tspDriverId" in body) {
    // Hard safety: never assign a CoPilot asset during Phase 1 planning.
    delete body.tspDriverId;
  }

  return body;
}

export function buildFuelOptimizerTmsTripId(openroadLoadId: number | string) {
  return `fo-${openroadLoadId}`;
}

export function isFuelOptimizerTmsTripId(tmsTripId: string | null | undefined) {
  return Boolean(tmsTripId && /^fo-\d+(-\d+)?$/.test(tmsTripId));
}
