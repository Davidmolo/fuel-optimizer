import { HttpError } from "../../utils/http-error";
import type { GeoPoint } from "../../utils/geo";
import { decodeEncodedPolyline } from "./decode-polyline";
import {
  getGoogleMapsApiKey,
  metersToMiles,
  parseDurationMinutes,
  ROUTE_MATRIX_BATCH_SIZE,
} from "./routing.config";
import type { DrivingDistanceResult, DrivingRouteResult } from "./routing.types";

const ROUTES_API_BASE_URL = "https://routes.googleapis.com";

type GoogleLatLng = {
  latitude: number;
  longitude: number;
};

type GoogleWaypoint = {
  location: {
    latLng: GoogleLatLng;
  };
};

type ComputeRoutesResponse = {
  routes?: Array<{
    distanceMeters?: number;
    duration?: string;
    polyline?: {
      encodedPolyline?: string;
    };
  }>;
  error?: {
    message?: string;
    status?: string;
  };
};

type ComputeRouteMatrixElement = {
  originIndex?: number;
  destinationIndex?: number;
  distanceMeters?: number;
  duration?: string;
  status?: Record<string, unknown>;
  condition?: string;
};

function toGoogleWaypoint(point: GeoPoint): GoogleWaypoint {
  return {
    location: {
      latLng: {
        latitude: point.lat,
        longitude: point.lng,
      },
    },
  };
}

function roundMiles(miles: number) {
  return Math.round(miles * 10) / 10;
}

async function googleRoutesRequest<T>(options: {
  path: string;
  body: unknown;
  fieldMask: string;
}): Promise<T> {
  const response = await fetch(`${ROUTES_API_BASE_URL}${options.path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": getGoogleMapsApiKey(),
      "X-Goog-FieldMask": options.fieldMask,
    },
    body: JSON.stringify(options.body),
  });

  const body = (await response.json().catch(() => null)) as T | { error?: { message?: string } } | null;

  if (!response.ok) {
    const message =
      (body && typeof body === "object" && "error" in body && body.error?.message) ||
      `Google Routes API request failed (${response.status})`;
    throw new HttpError(String(message), response.status >= 500 ? 502 : response.status);
  }

  return body as T;
}

export async function computeDrivingRoute(waypoints: GeoPoint[]): Promise<DrivingRouteResult> {
  if (waypoints.length < 2) {
    throw new HttpError("At least two waypoints are required to compute a driving route", 400);
  }

  const origin = waypoints[0];
  const destination = waypoints[waypoints.length - 1];
  const intermediates = waypoints.slice(1, -1).map(toGoogleWaypoint);

  const response = await googleRoutesRequest<ComputeRoutesResponse>({
    path: "/directions/v2:computeRoutes",
    fieldMask: "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
    body: {
      origin: toGoogleWaypoint(origin),
      destination: toGoogleWaypoint(destination),
      ...(intermediates.length > 0 ? { intermediates } : {}),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      computeAlternativeRoutes: false,
      routeModifiers: {
        avoidFerries: true,
      },
      units: "IMPERIAL",
      languageCode: "en-US",
    },
  });

  const route = response.routes?.[0];

  if (!route?.polyline?.encodedPolyline || route.distanceMeters === undefined) {
    throw new HttpError("Google Routes API did not return a usable driving route", 502);
  }

  return {
    polyline: decodeEncodedPolyline(route.polyline.encodedPolyline),
    distanceMiles: roundMiles(metersToMiles(route.distanceMeters)),
    durationMinutes: parseDurationMinutes(route.duration),
  };
}

export async function computeDrivingDistancesFromOrigin(options: {
  origin: GeoPoint;
  destinations: Array<GeoPoint & { key: string }>;
}): Promise<Map<string, DrivingDistanceResult>> {
  const results = new Map<string, DrivingDistanceResult>();

  if (options.destinations.length === 0) {
    return results;
  }

  for (let offset = 0; offset < options.destinations.length; offset += ROUTE_MATRIX_BATCH_SIZE) {
    const batch = options.destinations.slice(offset, offset + ROUTE_MATRIX_BATCH_SIZE);

    const response = await googleRoutesRequest<ComputeRouteMatrixElement[]>({
      path: "/distanceMatrix/v2:computeRouteMatrix",
      fieldMask: "originIndex,destinationIndex,distanceMeters,duration,status,condition",
      body: {
        origins: [
          {
            waypoint: toGoogleWaypoint(options.origin),
            routeModifiers: {
              avoidFerries: true,
            },
          },
        ],
        destinations: batch.map((destination) => ({
          waypoint: toGoogleWaypoint(destination),
        })),
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        units: "IMPERIAL",
      },
    });

    const elements = Array.isArray(response) ? response : [];

    for (const element of elements) {
      if (element.originIndex !== 0 || element.destinationIndex === undefined) {
        continue;
      }

      if (element.condition === "ROUTE_NOT_FOUND" || element.distanceMeters === undefined) {
        continue;
      }

      const destination = batch[element.destinationIndex];

      if (!destination) {
        continue;
      }

      results.set(destination.key, {
        distanceMiles: roundMiles(metersToMiles(element.distanceMeters)),
        durationMinutes: parseDurationMinutes(element.duration),
      });
    }
  }

  return results;
}
