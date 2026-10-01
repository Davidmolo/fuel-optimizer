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
    tspId: env.TRIMBLE_TSP_ID?.trim() || undefined,
    tmsCustomerId: env.TRIMBLE_TMS_CUSTOMER_ID?.trim() || undefined,
    tmsId: env.TRIMBLE_TMS_ID,
    tmsUserId: env.TRIMBLE_TMS_USER_ID?.trim() || undefined,
  };
}

/**
 * Optional Trimble identity fields that may be sent on Plan Trip / Modify Trip.
 * Trimble normally resolves these from the API key, but they can be supplied
 * explicitly when dispatch to CoPilot does not flip the trip to Dispatched.
 */
export type TripManagementIdentity = {
  tspId?: string;
  tmsCustomerId?: string;
  tmsId?: 0 | 1 | 2;
  tmsUserId?: string;
};

export function getTripManagementIdentity(): TripManagementIdentity {
  const { tspId, tmsCustomerId, tmsId, tmsUserId } = getTripManagementRuntimeConfig();
  const identity: TripManagementIdentity = {};

  if (tspId) identity.tspId = tspId;
  if (tmsCustomerId) identity.tmsCustomerId = tmsCustomerId;
  if (tmsId != null) identity.tmsId = tmsId as 0 | 1 | 2;
  if (tmsUserId) identity.tmsUserId = tmsUserId;

  return identity;
}
