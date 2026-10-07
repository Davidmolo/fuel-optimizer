import { HttpError } from "../../utils/http-error";
import type { GeoPoint } from "../../utils/geo";
import {
  applyTripManagementIdentity,
  buildPlanTripBody,
  buildRoutingProfile,
} from "./build-plan-trip-body";
import {
  getRoutingProfileName,
  getTripManagementIdentity,
  getTripManagementRuntimeConfig,
} from "./trip-management.config";
import type {
  TripManagementModifyTripRequest,
  TripManagementPlanTripRequest,
  TripManagementRoutePathResponse,
  TripManagementTripResponse,
} from "./trip-management.types";

async function tripManagementFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { apiKey, baseUrl } = getTripManagementRuntimeConfig();
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: apiKey,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const rawText = await response.text();
  let body: unknown = null;

  if (rawText) {
    try {
      body = JSON.parse(rawText);
    } catch {
      body = rawText;
    }
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    if (typeof body === "string" && body.trim()) {
      detail = body.slice(0, 240);
    } else if (typeof body === "object" && body) {
      const record = body as Record<string, unknown>;
      if (record.message != null) {
        detail = String(record.message);
      } else if (record.title != null) {
        detail = String(record.title);
      } else if (record.error != null) {
        detail = typeof record.error === "string" ? record.error : JSON.stringify(record.error).slice(0, 240);
      } else {
        detail = JSON.stringify(body).slice(0, 240);
      }
    }

    throw new HttpError(
      `Trimble Trip Management request failed (${response.status}): ${detail}`,
      response.status >= 500
        ? 502
        : response.status === 401 || response.status === 403
          ? 502
          : response.status,
    );
  }

  return body as T;
}

export async function planTrip(input: TripManagementPlanTripRequest): Promise<TripManagementTripResponse> {
  const identity = getTripManagementIdentity();
  const body = buildPlanTripBody({
    ...input,
    routingProfileName: input.routingProfileName ?? getRoutingProfileName(),
    tspId: input.tspId ?? identity.tspId,
    tmsCustomerId: input.tmsCustomerId ?? identity.tmsCustomerId,
    tmsId: input.tmsId ?? identity.tmsId,
    tmsUserId: input.tmsUserId ?? identity.tmsUserId,
  });
  const assigningTablet =
    Boolean(input.assignTablet) &&
    typeof body.tspDriverId === "string" &&
    body.tspDriverId.trim() !== "";

  if ("tspDriverId" in body && body.tspDriverId != null && body.tspDriverId !== "" && !assigningTablet) {
    throw new HttpError(
      "Refusing to plan a trip with tspDriverId. Phase 1 creates Planned trips only and must not notify tablets.",
      500,
    );
  }

  return tripManagementFetch<TripManagementTripResponse>("/trip", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function modifyTrip(input: TripManagementModifyTripRequest): Promise<TripManagementTripResponse> {
  if (!input.alkTripId) {
    throw new HttpError("modifyTrip requires alkTripId", 400);
  }

  const identity = getTripManagementIdentity();

  // Trimble Modify Trip identifies the trip as `tripId` (value = alkTripId from Plan Trip).
  const body: Record<string, unknown> = { tripId: input.alkTripId };

  if (input.tspDriverId != null && input.tspDriverId !== "") {
    body.tspDriverId = input.tspDriverId;
  }

  if (input.stops && input.stops.length > 0) {
    body.stops = input.stops.map((stop) => ({
      stopType: stop.stopType,
      location: {
        coords: { lat: stop.lat.toFixed(6), lon: stop.lon.toFixed(6) },
        ...(stop.label ? { label: stop.label } : {}),
      },
    }));
    body.routingProfile = buildRoutingProfile({
      routingType: input.routingType,
      routingProfileName: input.routingProfileName ?? getRoutingProfileName(),
    });
  }

  applyTripManagementIdentity(body, {
    tspId: input.tspId ?? identity.tspId,
    tmsCustomerId: input.tmsCustomerId ?? identity.tmsCustomerId,
    tmsId: input.tmsId ?? identity.tmsId,
    tmsUserId: input.tmsUserId ?? identity.tmsUserId,
  });

  return tripManagementFetch<TripManagementTripResponse>("/trip/modify", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function getTripByAlkTripId(alkTripId: number | string): Promise<TripManagementTripResponse> {
  return tripManagementFetch<TripManagementTripResponse>(`/trip/${encodeURIComponent(String(alkTripId))}`);
}

/** Deletes a Trip Management trip by alkTripId (clears tablet queue leftovers for FO tests). */
export async function deleteTrip(alkTripId: number | string): Promise<void> {
  await tripManagementFetch<unknown>(`/trip/${encodeURIComponent(String(alkTripId))}`, {
    method: "DELETE",
  });
}

export async function getTripByTmsTripId(tmsTripId: string): Promise<TripManagementTripResponse> {
  const query = new URLSearchParams({ tripId: tmsTripId });
  return tripManagementFetch<TripManagementTripResponse>(`/trip?${query.toString()}`);
}

export async function getTripRoutePath(alkTripId: number | string): Promise<TripManagementRoutePathResponse> {
  return tripManagementFetch<TripManagementRoutePathResponse>(
    `/trip/${encodeURIComponent(String(alkTripId))}/routePath`,
  );
}

export function countRoutePathCoordinates(path: TripManagementRoutePathResponse | null | undefined) {
  const coordinates = path?.geometry?.coordinates;
  if (!coordinates?.length) {
    return 0;
  }

  let count = 0;
  for (const line of coordinates) {
    count += line.length;
  }
  return count;
}

/**
 * Flattens Trimble MultiLineString coordinates ([lon, lat] pairs) into GeoPoint[].
 */
export function extractRoutePathPolyline(path: TripManagementRoutePathResponse | null | undefined): GeoPoint[] {
  const coordinates = path?.geometry?.coordinates;
  if (!coordinates?.length) {
    return [];
  }

  const points: GeoPoint[] = [];
  for (const line of coordinates) {
    if (!Array.isArray(line)) continue;
    for (const pair of line) {
      if (!Array.isArray(pair) || pair.length < 2) continue;
      const lon = Number(pair[0]);
      const lat = Number(pair[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      points.push({ lat, lng: lon });
    }
  }
  return points;
}

export function normalizeTripStatus(status: string | number | null | undefined) {
  if (status == null) {
    return "Unknown";
  }

  if (typeof status === "number") {
    switch (status) {
      case 0:
        return "Planned";
      case 1:
        return "Dispatched";
      case 2:
        return "InProgress";
      case 3:
        return "Completed";
      case 4:
        return "Canceled";
      case 5:
        return "Declined";
      case 6:
        return "Deleted";
      case 7:
        return "ReceivedByClient";
      default:
        return String(status);
    }
  }

  return String(status);
}

export function isTripDriverUnassigned(tspDriverId: string | null | undefined) {
  return tspDriverId == null || String(tspDriverId).trim() === "";
}
