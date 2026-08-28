import { env } from "../../config/env";

export const ROUTE_MATRIX_BATCH_SIZE = 25;
export const METERS_PER_MILE = 1609.344;

export function isRoutingConfigured() {
  return Boolean(env.GOOGLE_MAPS_API_KEY?.trim());
}

export function getGoogleMapsApiKey() {
  const apiKey = env.GOOGLE_MAPS_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is not configured");
  }

  return apiKey;
}

export function metersToMiles(meters: number) {
  return meters / METERS_PER_MILE;
}

export function parseDurationMinutes(duration: string | undefined) {
  if (!duration) {
    return 0;
  }

  const seconds = Number.parseInt(duration.replace(/s$/, ""), 10);

  if (!Number.isFinite(seconds)) {
    return 0;
  }

  return Math.round((seconds / 60) * 10) / 10;
}
