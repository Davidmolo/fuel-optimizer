import { env } from "../../config/env";
import { HttpError } from "../../utils/http-error";
import type {
  OpenRoadAssignment,
  OpenRoadAssignmentsResponse,
  OpenRoadDriver,
  OpenRoadDriversResponse,
  OpenRoadFuelCardTransaction,
  OpenRoadFuelCardTransactionsResponse,
  OpenRoadLoad,
  OpenRoadLoadsResponse,
  OpenRoadPaginationMeta,
  OpenRoadTruck,
  OpenRoadTrucksResponse,
} from "./openroad.types";

type RequestOptions = {
  path: string;
  query?: Record<string, string | number | undefined>;
};

function getOpenRoadRuntimeConfig() {
  if (!env.OPENROAD_API_TOKEN) {
    throw new HttpError("Open Road API token is not configured", 503);
  }

  return {
    baseUrl: env.OPENROAD_API_BASE_URL.replace(/\/$/, ""),
    token: env.OPENROAD_API_TOKEN,
  };
}

async function openroadRequest<T>({ path, query }: RequestOptions): Promise<T> {
  const { baseUrl, token } = getOpenRoadRuntimeConfig();
  const url = new URL(`${baseUrl}${path}`);

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
      "Http-Access-Token": token,
    },
  }).catch((error: unknown) => {
    const detail = error instanceof Error ? error.message : "network error";
    throw new HttpError(`Open Road API is unreachable: ${detail}`, 503);
  });

  const body = (await response.json().catch(() => null)) as
    | { message?: string; error?: string }
    | T
    | null;

  if (!response.ok) {
    const errorBody = body && typeof body === "object" ? (body as { message?: string; error?: string }) : null;
    const message =
      errorBody?.message ||
      errorBody?.error ||
      `Open Road API request failed (${response.status})`;
    throw new HttpError(String(message), response.status >= 500 ? 502 : response.status);
  }

  return body as T;
}

async function fetchAllPages<TItem>(
  fetchPage: (page: number) => Promise<OpenRoadPaginationMeta & { [key: string]: unknown }>,
  collectionKey: string,
) {
  const results: TItem[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await fetchPage(page);
    const items = response[collectionKey];

    if (!Array.isArray(items)) {
      throw new HttpError(`Open Road API returned an unexpected response for ${collectionKey}`, 502);
    }

    results.push(...(items as TItem[]));
    totalPages = response.total_pages || 1;
    page += 1;
  } while (page <= totalPages);

  return results;
}

export async function listOpenRoadTrucks(status?: string) {
  return fetchAllPages<OpenRoadTruck>(
    (page) =>
      openroadRequest<OpenRoadTrucksResponse>({
        path: "/trucks",
        query: { page, status },
      }),
    "trucks",
  );
}

export async function listOpenRoadDrivers() {
  return fetchAllPages<OpenRoadDriver>(
    (page) =>
      openroadRequest<OpenRoadDriversResponse>({
        path: "/drivers",
        query: { page },
      }),
    "drivers",
  );
}

export async function listOpenRoadAssignments(filters?: {
  driverId?: number;
  assignmentType?: "Truck" | "Trailer";
}) {
  return fetchAllPages<OpenRoadAssignment>(
    (page) =>
      openroadRequest<OpenRoadAssignmentsResponse>({
        path: "/assignments",
        query: {
          page,
          driver_id: filters?.driverId,
          assignment_type: filters?.assignmentType,
        },
      }),
    "assignments",
  );
}

export async function listOpenRoadActiveLoads(filters?: { driverId?: number; employeeNr?: string }) {
  return fetchAllPages<OpenRoadLoad>(
    (page) =>
      openroadRequest<OpenRoadLoadsResponse>({
        path: "/active_loads",
        query: {
          page,
          driver_id: filters?.driverId,
          employee_nr: filters?.employeeNr,
        },
      }),
    "loads",
  );
}

export async function listOpenRoadAllLoads(filters?: { driverId?: number; employeeNr?: string }) {
  return fetchAllPages<OpenRoadLoad>(
    (page) =>
      openroadRequest<OpenRoadLoadsResponse>({
        path: "/all_loads",
        query: {
          page,
          driver_id: filters?.driverId,
          employee_nr: filters?.employeeNr,
        },
      }),
    "loads",
  );
}

export async function listOpenRoadFuelCardTransactions(filters?: {
  driverId?: number;
  dateFrom?: string;
  dateTo?: string;
}) {
  return fetchAllPages<OpenRoadFuelCardTransaction>(
    (page) =>
      openroadRequest<OpenRoadFuelCardTransactionsResponse>({
        path: "/fuel_card_transactions",
        query: {
          page,
          driver_id: filters?.driverId,
          date_from: filters?.dateFrom,
          date_to: filters?.dateTo,
        },
      }),
    "fuel_card_transactions",
  );
}
