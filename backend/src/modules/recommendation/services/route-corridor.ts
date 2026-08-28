import { polylineLengthMiles, type GeoPoint } from "../../../utils/geo";
import type { TmsLoadDestinationView } from "../../tms/mappers/trip-context.mapper";

function hasValidCoordinates(destination: {
  lat?: number;
  lng?: number;
}): destination is { lat: number; lng: number } {
  return (
    destination.lat !== undefined &&
    destination.lng !== undefined &&
    Number.isFinite(destination.lat) &&
    Number.isFinite(destination.lng)
  );
}

function toGeoPoint(lat: number, lng: number): GeoPoint {
  return { lat, lng };
}

export function buildRoutePolyline(options: {
  truckPosition?: GeoPoint;
  destinations: TmsLoadDestinationView[];
  includeCompletedStops?: boolean;
}): GeoPoint[] {
  const { truckPosition, destinations, includeCompletedStops = false } = options;
  const sortedDestinations = [...destinations].sort((left, right) => left.position - right.position);
  const routePoints: GeoPoint[] = [];

  if (truckPosition) {
    routePoints.push(truckPosition);
  }

  for (const destination of sortedDestinations) {
    if (!includeCompletedStops && destination.completed) {
      continue;
    }

    if (!hasValidCoordinates(destination)) {
      continue;
    }

    const point = toGeoPoint(destination.lat, destination.lng);
    const lastPoint = routePoints[routePoints.length - 1];

    if (lastPoint && lastPoint.lat === point.lat && lastPoint.lng === point.lng) {
      continue;
    }

    routePoints.push(point);
  }

  return routePoints;
}

export function buildRouteCorridor(polyline: GeoPoint[], bufferMiles: number) {
  return {
    polyline,
    bufferMiles,
    pointCount: polyline.length,
    routeLengthMiles: polyline.length >= 2 ? Math.round(polylineLengthMiles(polyline) * 10) / 10 : 0,
  };
}

export function buildRecommendationRoutePolyline(options: {
  truckPosition: GeoPoint;
  destinations: TmsLoadDestinationView[];
}): GeoPoint[] {
  const forwardPolyline = buildRoutePolyline({
    truckPosition: options.truckPosition,
    destinations: options.destinations,
    includeCompletedStops: false,
  });

  if (forwardPolyline.length >= 2 && polylineLengthMiles(forwardPolyline) >= 10) {
    return forwardPolyline;
  }

  const tripPolyline = buildRoutePolyline({
    destinations: options.destinations,
    includeCompletedStops: true,
  });

  if (tripPolyline.length >= 2 && polylineLengthMiles(tripPolyline) > polylineLengthMiles(forwardPolyline)) {
    return tripPolyline;
  }

  if (forwardPolyline.length >= 2) {
    return forwardPolyline;
  }

  const remainingStops = [...options.destinations]
    .filter((destination) => !destination.completed && hasValidCoordinates(destination))
    .sort((left, right) => right.position - left.position);

  const nextStop = remainingStops.find((destination) => hasValidCoordinates(destination));

  if (nextStop) {
    return [options.truckPosition, toGeoPoint(nextStop.lat, nextStop.lng)];
  }

  return forwardPolyline;
}

export const DEGENERATE_ROUTE_MILES = 10;

export function isDegenerateRecommendationRoute(routeLengthMiles: number) {
  return routeLengthMiles < DEGENERATE_ROUTE_MILES;
}
