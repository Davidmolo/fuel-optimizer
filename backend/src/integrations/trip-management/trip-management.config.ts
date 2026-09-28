import { env } from "../../config/env";
import { HttpError } from "../../utils/http-error";

export const DEFAULT_TRIP_MANAGEMENT_API_BASE_URL = "https://tripmanagement.trimblemaps.com/api";

export function isTripManagementConfigured() {
  return Boolean(env.TRIMBLE_API_KEY?.trim());
}

export function getTripManagementRuntimeConfig() {
  const apiKey = env.TRIMBLE_API_KEY?.trim();

  if (!apiKey) {
    throw new HttpError(
      "Trimble API key is not configured. Set TRIMBLE_API_KEY in the environment.",
      503,
    );
  }

  const configuredBaseUrl = env.TRIMBLE_TRIP_MANAGEMENT_API_BASE_URL?.replace(/\/+$/, "");

  return {
    baseUrl: configuredBaseUrl || DEFAULT_TRIP_MANAGEMENT_API_BASE_URL,
    apiKey,
  };
}
