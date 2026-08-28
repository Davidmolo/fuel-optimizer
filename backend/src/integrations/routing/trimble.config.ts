import { env } from "../../config/env";
import { HttpError } from "../../utils/http-error";

export const DEFAULT_TRIMBLE_API_BASE_URL = "https://pcmiler.alk.com/apis/rest/v1.0/Service.svc";

export function isTrimbleRoutingConfigured() {
  return Boolean(env.TRIMBLE_API_KEY?.trim());
}

export function getTrimbleRuntimeConfig() {
  const apiKey = env.TRIMBLE_API_KEY?.trim();

  if (!apiKey) {
    throw new HttpError("Trimble API key is not configured. Set TRIMBLE_API_KEY in the environment.", 503);
  }

  return {
    baseUrl: env.TRIMBLE_API_BASE_URL.replace(/\/+$/, "") || DEFAULT_TRIMBLE_API_BASE_URL,
    apiKey,
  };
}
