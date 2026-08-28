import { HttpError } from "../../utils/http-error";
import type { GeoPoint } from "../../utils/geo";
import { getTrimbleRuntimeConfig } from "./trimble.config";
import type { DrivingRouteResult } from "./routing.types";

type TrimbleRoutePathResponse = {
  type?: string;
  geometry?: {
    type?: string;
    coordinates?: Array<Array<[number, number]>>;
  };
  TMinutes?: number;
  TDistance?: number;
};

function roundMiles(miles: number) {
  return Math.round(miles * 10) / 10;
}

export function buildTrimbleStopsPath(waypoints: GeoPoint[]) {
  return waypoints.map((point) => `${point.lng},${point.lat}`).join(";");
}

function flattenRouteCoordinates(coordinates: Array<Array<[number, number]>> | undefined): GeoPoint[] {
  if (!coordinates?.length) {
    return [];
  }

  const points: GeoPoint[] = [];

  for (const line of coordinates) {
    for (const pair of line) {
      const [lng, lat] = pair;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        continue;
      }
      points.push({ lat, lng });
    }
  }

  return points;
}

export async function computeTrimbleDrivingRoute(waypoints: GeoPoint[]): Promise<DrivingRouteResult> {
  if (waypoints.length < 2) {
    throw new HttpError("At least two waypoints are required to compute a driving route", 400);
  }

  const { apiKey, baseUrl } = getTrimbleRuntimeConfig();
  const url = new URL(`${baseUrl}/route/routePath`);
  url.searchParams.set("stops", buildTrimbleStopsPath(waypoints));
  url.searchParams.set("vehType", "0");
  url.searchParams.set("routeType", "0");
  url.searchParams.set("hwyOnly", "false");
  url.searchParams.set("distUnits", "0");
  url.searchParams.set("region", "4");

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: apiKey,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new HttpError(
      `Trimble route request failed (${response.status})`,
      response.status >= 500 ? 502 : response.status === 401 || response.status === 403 ? 502 : response.status,
    );
  }

  const body = (await response.json().catch(() => null)) as TrimbleRoutePathResponse | null;
  const polyline = flattenRouteCoordinates(body?.geometry?.coordinates);

  if (polyline.length < 2) {
    throw new HttpError("Trimble did not return a usable driving route", 502);
  }

  const distanceMiles = Number.isFinite(body?.TDistance) ? roundMiles(Number(body?.TDistance)) : 0;
  const durationMinutes = Number.isFinite(body?.TMinutes)
    ? Math.round(Number(body?.TMinutes) * 10) / 10
    : 0;

  return {
    polyline,
    distanceMiles,
    durationMinutes,
  };
}
