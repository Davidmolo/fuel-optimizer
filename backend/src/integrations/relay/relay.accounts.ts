import { env } from "../../config/env";
import { HttpError } from "../../utils/http-error";

export const RELAY_ACCOUNTS = ["blue_stallion", "azfs"] as const;

export type RelayAccount = (typeof RELAY_ACCOUNTS)[number];

const RELAY_ACCOUNT_ENV_KEYS = {
  blue_stallion: "RELAY_API_KEY_BLUE_STALLION",
  azfs: "RELAY_API_KEY_AZFS",
} as const satisfies Record<RelayAccount, "RELAY_API_KEY_BLUE_STALLION" | "RELAY_API_KEY_AZFS">;

export function getConfiguredRelayAccounts(): RelayAccount[] {
  return RELAY_ACCOUNTS.filter((account) => Boolean(env[RELAY_ACCOUNT_ENV_KEYS[account]]));
}

export function getRelayApiKey(account: RelayAccount): string {
  const envKey = RELAY_ACCOUNT_ENV_KEYS[account];
  const apiKey = env[envKey];

  if (!apiKey) {
    throw new HttpError(`Relay API key is not configured for account "${account}"`, 503);
  }

  return apiKey;
}

export function getRelayBaseUrl(): string {
  return env.RELAY_API_BASE_URL.replace(/\/$/, "");
}

export function getRelayTransactionsBaseUrl(): string {
  const baseUrl = getRelayBaseUrl();

  if (baseUrl.endsWith("/integrations")) {
    return baseUrl.replace(/\/integrations$/, "");
  }

  return baseUrl;
}
