import { HttpError } from "../../utils/http-error";
import { getSamsaraRuntimeConfig } from "./samsara.config";
import type {
  SamsaraPaginatedResponse,
  SamsaraVehicle,
  SamsaraVehicleStats,
} from "./samsara.types";

type RequestOptions = {
  path: string;
  query?: Record<string, string | undefined>;
};

async function samsaraRequest<T>({ path, query }: RequestOptions): Promise<T> {
  const { baseUrl, token } = getSamsaraRuntimeConfig();
  const url = new URL(`${baseUrl}${path}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    }
  }

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
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
      `Samsara API request failed (${response.status})`;
    throw new HttpError(String(message), response.status >= 500 ? 502 : response.status);
  }

  return body as T;
}

async function fetchAllPages<T>(fetchPage: (after?: string) => Promise<SamsaraPaginatedResponse<T>>) {
  const results: T[] = [];
  let after: string | undefined;

  do {
    const page = await fetchPage(after);
    results.push(...page.data);
    after = page.pagination.hasNextPage ? page.pagination.endCursor || undefined : undefined;
  } while (after);

  return results;
}

export async function listSamsaraVehicles() {
  return fetchAllPages<SamsaraVehicle>((after) =>
    samsaraRequest<SamsaraPaginatedResponse<SamsaraVehicle>>({
      path: "/fleet/vehicles",
      query: {
        after,
      },
    }),
  );
}

export async function getSamsaraVehicleStats(types = "gps,fuelPercents") {
  return fetchAllPages<SamsaraVehicleStats>((after) =>
    samsaraRequest<SamsaraPaginatedResponse<SamsaraVehicleStats>>({
      path: "/fleet/vehicles/stats",
      query: {
        types,
        after,
      },
    }),
  );
}
