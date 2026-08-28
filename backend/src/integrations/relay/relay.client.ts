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

  const response = await fetch(url, {
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

  if (windows.length === 1) {
    return fetchRelayFuelTransactionsForWindow(account, windows[0]!);
  }

  const transactionsById = new Map<string, RelayTransaction>();

  for (const window of windows) {
    const batch = await fetchRelayFuelTransactionsForWindow(account, window);

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
