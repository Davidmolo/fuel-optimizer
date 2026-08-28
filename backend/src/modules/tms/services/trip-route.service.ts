import {
  computeDrivingRoute,
  usesTrimbleRouting,
} from "../../../integrations/routing";
import { HttpError } from "../../../utils/http-error";
import type { GeoPoint } from "../../../utils/geo";
import {
  buildRecommendationRoutePolyline,
  buildRoutePolyline,
} from "../../recommendation/services/route-corridor";
import type { TmsLoadDestinationView } from "../mappers/trip-context.mapper";
import { getTripContext } from "./tms-query.service";

function toTruckPosition(gps?: { latitude: number; longitude: number }): GeoPoint | undefined {
  if (
    gps &&
    Number.isFinite(gps.latitude) &&
    Number.isFinite(gps.longitude) &&
    Math.abs(gps.latitude) <= 90 &&
    Math.abs(gps.longitude) <= 180
  ) {
    return { lat: gps.latitude, lng: gps.longitude };
  }

  return undefined;
}

export function buildTripDrivingWaypoints(options: {
  truckPosition?: GeoPoint;
  destinations: TmsLoadDestinationView[];
}) {
  const truckPosition = options.truckPosition;
  const destinations = options.destinations;

  if (truckPosition) {
    const forwardPolyline = buildRecommendationRoutePolyline({
      truckPosition,
      destinations,
    });

    if (forwardPolyline.length >= 2) {
      return forwardPolyline;
    }
  }

  return buildRoutePolyline({
    destinations,
    includeCompletedStops: false,
  });
}

export async function getTripDrivingRoute(identifier: string) {
  const trip = await getTripContext(identifier);
  const waypoints = buildTripDrivingWaypoints({
    truckPosition: toTruckPosition(trip.vehicle?.gps),
    destinations: trip.load.destinations,
  });

  if (waypoints.length < 2) {
    throw new HttpError(
      "Not enough geocoded stops to compute a driving route. Sync Open Road TMS and confirm truck GPS.",
      400,
    );
  }

  const route = await computeDrivingRoute(waypoints);

  return {
    routeLabel: trip.load.routeLabel,
    waypointCount: waypoints.length,
    waypoints,
    polyline: route.polyline,
    distanceMiles: route.distanceMiles,
    durationMinutes: route.durationMinutes,
    source: usesTrimbleRouting() ? ("trimble" as const) : ("osrm" as const),
  };
}
