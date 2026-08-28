import { env } from "../../config/env";
import { HttpError } from "../../utils/http-error";

export function isSamsaraConfigured() {
  return Boolean(env.SAMSARA_API_TOKEN?.trim());
}

export function getSamsaraRuntimeConfig() {
  const token = env.SAMSARA_API_TOKEN?.trim();

  if (!token) {
    throw new HttpError("Samsara API token is not configured", 503);
  }

  return {
    baseUrl: env.SAMSARA_API_BASE_URL.replace(/\/$/, ""),
    token,
  };
}

export function getSamsaraTelemetryStaleMs() {
  return env.SAMSARA_TELEMETRY_STALE_MINUTES * 60 * 1000;
}
