import { HttpError } from "../../utils/http-error";
import type { GeoPoint } from "../../utils/geo";
import { metersToMiles } from "./routing.config";
import type { DrivingRouteResult } from "./routing.types";

const DEFAULT_OSRM_BASE_URL = "https://router.project-osrm.org";

type OsrmRouteResponse = {
  code?: string;
  message?: string;
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: {
      coordinates?: Array<[number, number]>;
    };
  }>;
};

function roundMiles(miles: number) {
  return Math.round(miles * 10) / 10;
}

function getOsrmBaseUrl() {
  return process.env.OSRM_API_BASE_URL?.trim() || DEFAULT_OSRM_BASE_URL;
}

export function buildOsrmCoordinatePath(waypoints: GeoPoint[]) {
  return waypoints.map((point) => `${point.lng},${point.lat}`).join(";");
}

export async function computeOsrmDrivingRoute(waypoints: GeoPoint[]): Promise<DrivingRouteResult> {
  if (waypoints.length < 2) {
    throw new HttpError("At least two waypoints are required to compute a driving route", 400);
  }

  const coordinatePath = buildOsrmCoordinatePath(waypoints);
  const url = new URL(`/route/v1/driving/${coordinatePath}`, getOsrmBaseUrl());
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("steps", "false");

  const response = await fetch(url);

  if (!response.ok) {
    throw new HttpError(`OSRM route request failed (${response.status})`, response.status >= 500 ? 502 : response.status);
  }

  const body = (await response.json().catch(() => null)) as OsrmRouteResponse | null;
  const route = body?.routes?.[0];
  const coordinates = route?.geometry?.coordinates;

  if (body?.code !== "Ok" || !route || !coordinates || coordinates.length < 2) {
    const message = body?.message || "OSRM did not return a usable driving route";
    throw new HttpError(message, 502);
  }

  return {
    polyline: coordinates.map(([lng, lat]) => ({ lat, lng })),
    distanceMiles: roundMiles(metersToMiles(route.distance ?? 0)),
    durationMinutes: Math.round(((route.duration ?? 0) / 60) * 10) / 10,
  };
}
