import {
  computeDrivingDistancesFromOrigin,
  computeDrivingRoute,
  isRoutingConfigured,
  usesGoogleRouting,
  usesTrimbleRouting,
} from "../../../integrations/routing";
import type { GeoPoint } from "../../../utils/geo";

export type StationDrivingDistanceLookup = Map<
  string,
  {
    distanceMiles: number;
    durationMinutes: number;
  }
>;

export function isRecommendationRoutingConfigured() {
  return isRoutingConfigured();
}

export function isRecommendationUsingGoogleRouting() {
  return usesGoogleRouting();
}

export function isRecommendationUsingTrimbleRouting() {
  return usesTrimbleRouting();
}

export async function buildDrivingRoutePolyline(waypoints: GeoPoint[]) {
  const route = await computeDrivingRoute(waypoints);

  return {
    polyline: route.polyline,
    routeLengthMiles: route.distanceMiles,
    durationMinutes: route.durationMinutes,
  };
}

export async function fetchDrivingDistancesToStations(options: {
  truckPosition: GeoPoint;
  stations: Array<{
    relayLocationId: string;
    latitude: number;
    longitude: number;
  }>;
}): Promise<StationDrivingDistanceLookup> {
  const destinations = options.stations.map((station) => ({
    key: station.relayLocationId,
    lat: station.latitude,
    lng: station.longitude,
  }));

  return computeDrivingDistancesFromOrigin({
    origin: options.truckPosition,
    destinations,
  });
}
