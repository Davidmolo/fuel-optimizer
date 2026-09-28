import type { TripManagementPlanTripRequest } from "./trip-management.types";

function formatCoordinate(value: number) {
  return value.toFixed(6);
}

/**
 * Builds a Plan Trip body for Phase 1.
 * Intentionally omits tspDriverId so Trimble creates a Planned trip and does not notify any tablet.
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
    routingProfile: {
      routingType: input.routingType ?? 0,
    },
  };

  if (input.tmsTripId) {
    body.tmsTripId = input.tmsTripId;
  }

  if (input.name) {
    body.name = input.name;
  }

  // Hard safety: never assign a CoPilot asset during Phase 1 planning.
  if ("tspDriverId" in body) {
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
