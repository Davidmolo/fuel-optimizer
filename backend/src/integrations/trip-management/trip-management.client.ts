import { HttpError } from "../../utils/http-error";
import { buildPlanTripBody } from "./build-plan-trip-body";
import { getTripManagementRuntimeConfig } from "./trip-management.config";
import type {
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
    const detail =
      typeof body === "object" && body && "message" in body
        ? String((body as { message?: unknown }).message)
        : typeof body === "string"
          ? body.slice(0, 240)
          : `HTTP ${response.status}`;

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
  const body = buildPlanTripBody(input);

  if ("tspDriverId" in body && body.tspDriverId != null && body.tspDriverId !== "") {
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

export async function getTripByAlkTripId(alkTripId: number | string): Promise<TripManagementTripResponse> {
  return tripManagementFetch<TripManagementTripResponse>(`/trip/${encodeURIComponent(String(alkTripId))}`);
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
      default:
        return String(status);
    }
  }

  return String(status);
}

export function isTripDriverUnassigned(tspDriverId: string | null | undefined) {
  return tspDriverId == null || String(tspDriverId).trim() === "";
}
