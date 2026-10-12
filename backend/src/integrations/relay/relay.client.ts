import { HttpError } from "../../utils/http-error";
import type { RelayAccount } from "./relay.accounts";
import { getRelayApiKey, getRelayBaseUrl, getRelayTransactionsBaseUrl } from "./relay.accounts";
import {
  DEFAULT_RELAY_TRANSACTION_CHUNK_DAYS,
  splitDateRangeIntoWindows,
  type RelayDateWindow,
} from "./relay-date-windows";
import type { RelayDriver, RelayTransaction } from "./relay.types";

type RequestOptions = {
  account: RelayAccount;
  path: string;
  query?: Record<string, string | number | undefined>;
  emptyOn404?: boolean;
  baseUrl?: string;
};

const DRIVER_PAGE_SIZE = 50;
const RELAY_MAX_ATTEMPTS = 5;
const RELAY_RETRY_BASE_DELAY_MS = 1_000;
const RELAY_RETRY_MAX_DELAY_MS = 60_000;
/** Pause between paced Relay calls so parallel account syncs do not burst the shared limit. */
const RELAY_INTER_REQUEST_DELAY_MS = 250;

export function isRetryableRelayStatus(status: number) {
  return status === 429 || status >= 500;
}

export function relayRetryDelayMs(attempt: number, retryAfterHeader?: string | null) {
  const exponential = Math.min(RELAY_RETRY_BASE_DELAY_MS * 2 ** attempt, RELAY_RETRY_MAX_DELAY_MS);

  if (retryAfterHeader) {
    const seconds = Number.parseFloat(retryAfterHeader);

    // Relay sometimes returns Retry-After: 0 on 429. Never sleep 0 — keep at least
    // exponential backoff so three quick 429s cannot fail the job in <100ms.
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(Math.max(seconds * 1000, exponential), RELAY_RETRY_MAX_DELAY_MS);
    }
  }

  return exponential;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Fetch with retries on transient failures (network errors, 429, 5xx) so a
 * blip like "fetch failed" does not fail the whole sync job.
 */
async function fetchWithRelayRetry(url: URL, init: RequestInit) {
  let attempt = 0;

  while (true) {
    let response: Response;

    try {
      response = await fetch(url, init);
    } catch (error) {
      if (attempt + 1 >= RELAY_MAX_ATTEMPTS) {
        const detail = error instanceof Error ? error.message : "network error";
        throw new HttpError(`Relay API is unreachable: ${detail}`, 503);
      }

      await sleep(relayRetryDelayMs(attempt));
      attempt += 1;
      continue;
    }

    if (isRetryableRelayStatus(response.status) && attempt + 1 < RELAY_MAX_ATTEMPTS) {
      await sleep(relayRetryDelayMs(attempt, response.headers.get("retry-after")));
      attempt += 1;
      continue;
    }

    return response;
  }
}

async function relayRequest<T>({ account, path, query, emptyOn404, baseUrl }: RequestOptions): Promise<T> {
  const requestBaseUrl = (baseUrl ?? getRelayBaseUrl()).replace(/\/$/, "");
  const apiKey = getRelayApiKey(account);
  const url = new URL(`${requestBaseUrl}${path}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const response = await fetchWithRelayRetry(url, {
    headers: {
      Accept: "application/json",
      Authorization: apiKey,
    },
  });

  if (response.status === 404 && emptyOn404) {
    return [] as T;
  }

  const body = (await response.json().catch(() => null)) as
    | { message?: string; error?: string }
    | T
    | null;

  if (!response.ok) {
    const errorBody = body && typeof body === "object" ? (body as { message?: string; error?: string }) : null;
    const message =
      errorBody?.message ||
      errorBody?.error ||
      `Relay API request failed (${response.status})`;
    throw new HttpError(String(message), response.status >= 500 ? 502 : response.status);
  }

  return body as T;
}

function normalizeRelayArray<T>(body: T[] | { results?: T[]; data?: T[] } | null | undefined): T[] {
  if (!body) {
    return [];
  }

  if (Array.isArray(body)) {
    return body;
  }

  if (Array.isArray(body.results)) {
    return body.results;
  }

  if (Array.isArray(body.data)) {
    return body.data;
  }

  return [];
}

export async function listRelayDrivers(account: RelayAccount) {
  const results: RelayDriver[] = [];
  let offset = 0;

  while (true) {
    if (offset > 0) {
      await sleep(RELAY_INTER_REQUEST_DELAY_MS);
    }

    const page = normalizeRelayArray(
      await relayRequest<RelayDriver[] | { results?: RelayDriver[]; data?: RelayDriver[] }>({
        account,
        path: "/drivers/",
        query: {
          offset,
          limit: DRIVER_PAGE_SIZE,
        },
      }),
    );

    results.push(...page);

    if (page.length < DRIVER_PAGE_SIZE) {
      break;
    }

    offset += DRIVER_PAGE_SIZE;
  }

  return results;
}

export async function listRelayFuelTransactions(
  account: RelayAccount,
  filters: { dtstart: string; dtend: string },
  options: { chunkDays?: number } = {},
) {
  const chunkDays = options.chunkDays ?? DEFAULT_RELAY_TRANSACTION_CHUNK_DAYS;
  const windows = splitDateRangeIntoWindows(filters.dtstart, filters.dtend, chunkDays);
  const transactionsById = new Map<string, RelayTransaction>();

  for (let index = 0; index < windows.length; index += 1) {
    if (index > 0) {
      await sleep(RELAY_INTER_REQUEST_DELAY_MS);
    }

    const batch = await fetchRelayFuelTransactionsForWindow(account, windows[index]!);

    for (const transaction of batch) {
      const key = transaction.transaction_id || `${transaction.created_at}:${transactionsById.size}`;
      transactionsById.set(key, transaction);
    }
  }

  return [...transactionsById.values()];
}

async function fetchRelayFuelTransactionsForWindow(account: RelayAccount, window: RelayDateWindow) {
  return normalizeRelayArray(
    await relayRequest<RelayTransaction[] | { results?: RelayTransaction[]; data?: RelayTransaction[] }>({
      account,
      baseUrl: getRelayTransactionsBaseUrl(),
      path: "/fuel/transactions/",
      query: {
        dtstart: window.dtstart,
        dtend: window.dtend,
      },
      emptyOn404: true,
    }),
  );
}
