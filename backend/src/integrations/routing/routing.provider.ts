import type { GeoPoint } from "../../utils/geo";
import { haversineDistanceMiles } from "../../utils/geo";
import { computeOsrmDrivingRoute } from "./osrm-routes.client";
import { isTrimbleRoutingConfigured } from "./trimble.config";
import { computeTrimbleDrivingRoute } from "./trimble-routes.client";
import type { DrivingDistanceResult, DrivingRouteResult } from "./routing.types";

function estimateDrivingMinutes(distanceMiles: number) {
  const averageMph = 55;
  return Math.round((distanceMiles / averageMph) * 60 * 10) / 10;
}

export function isRoutingConfigured() {
  return true;
}

/** Google routing is no longer selected; kept for call-site compatibility. */
export function usesGoogleRouting() {
  return false;
}

export function usesTrimbleRouting() {
  return isTrimbleRoutingConfigured();
}

export async function computeDrivingRoute(waypoints: GeoPoint[]): Promise<DrivingRouteResult> {
  if (isTrimbleRoutingConfigured()) {
    return computeTrimbleDrivingRoute(waypoints);
  }

  return computeOsrmDrivingRoute(waypoints);
}

export async function computeDrivingDistancesFromOrigin(options: {
  origin: GeoPoint;
  destinations: Array<GeoPoint & { key: string }>;
}): Promise<Map<string, DrivingDistanceResult>> {
  const results = new Map<string, DrivingDistanceResult>();

  for (const destination of options.destinations) {
    const distanceMiles = haversineDistanceMiles(options.origin, destination);
    results.set(destination.key, {
      distanceMiles: Math.round(distanceMiles * 10) / 10,
      durationMinutes: estimateDrivingMinutes(distanceMiles),
    });
  }

  return results;
}
