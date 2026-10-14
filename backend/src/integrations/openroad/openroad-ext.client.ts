/**
 * Open Road TMS External API v1 client (`/api/ext/v1`).
 *
 * Open Road removed `/trucks`, `/active_loads`, and `/assignments` from the
 * legacy V2 API (they now answer 404 "Not Found"), which is why the
 * `openroad.loads`, `openroad.assignments`, and `openroad.fleet` sync jobs
 * were failing. This client reads those resources from the External API v1
 * (HTTP Basic auth, `{ data, error, meta }` envelope, `page`/`per_page`
 * pagination) and maps responses onto the legacy `OpenRoad*` types so the
 * sync services keep working unchanged.
 *
 * The driver roster stays on the legacy V2 API (`/api/v2/drivers` still works
 * and exposes richer fields), so it is not fetched here.
 *
 * Reference: https://app.openroadtms.com/llms-full.txt
 */

import { env } from "../../config/env";
import { HttpError } from "../../utils/http-error";
import type { OpenRoadAssignment, OpenRoadLoad, OpenRoadLoadDestination, OpenRoadTruck } from "./openroad.types";
import type {
  OpenRoadExtAssignment,
  OpenRoadExtDestination,
  OpenRoadExtDriver,
  OpenRoadExtEnvelope,
  OpenRoadExtEquipmentSummary,
  OpenRoadExtLoad,
  OpenRoadExtTruck,
  OpenRoadExtUser,
} from "./openroad-ext.types";

const EXT_PAGE_SIZE = 100;
const DEFAULT_EXT_MAX_ATTEMPTS = 3;
const EXT_RETRY_BASE_DELAY_MS = 500;
const EXT_RETRY_MAX_DELAY_MS = 30_000;

/**
 * Load statuses that make a load "active" for fuel planning — the same
 * delivering statuses the removed V2 `/active_loads` endpoint returned
 * (assigned through at-consignee), minus terminal states like delivered,
 * billed, closed, canceled, and booked loads without a driver.
 */
export const OPENROAD_EXT_ACTIVE_LOAD_STATUSES = [
  "assigned",
  "en_route_to_shipper",
  "at_shipper",
  "picked_up",
  "delayed",
  "en_route_to_consignee",
  "at_consignee",
] as const;

export function isOpenRoadExtConfigured() {
  return Boolean(env.OPENROAD_EXT_CLIENT_ID?.trim() && env.OPENROAD_EXT_CLIENT_SECRET?.trim());
}

type OpenRoadExtRuntime = {
  baseUrl: string;
  authorization: string;
};

function getOpenRoadExtRuntimeConfig(): OpenRoadExtRuntime {
  const clientId = env.OPENROAD_EXT_CLIENT_ID?.trim();
  const clientSecret = env.OPENROAD_EXT_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new HttpError("Open Road External API v1 credentials are not configured", 503);
  }

  return {
    baseUrl: env.OPENROAD_EXT_API_BASE_URL.replace(/\/$/, ""),
    authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
  };
}

type OpenRoadExtQueryValue = string | number | undefined | Array<string | number>;
type OpenRoadExtQuery = Record<string, OpenRoadExtQueryValue>;

/**
 * Builds query params for the External API query DSL. Multi-value filters must
 * use the bracket form (`status[]=a&status[]=b`) — the repeated non-bracketed
 * form is silently parsed as a single value.
 */
export function buildOpenRoadExtQuery(query?: OpenRoadExtQuery): URLSearchParams {
  const params = new URLSearchParams();

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") {
        continue;
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          if (item !== undefined && item !== null && item !== "") {
            params.append(`${key}[]`, String(item));
          }
        }
      } else {
        params.set(key, String(value));
      }
    }
  }

  return params;
}

export function isRetryableOpenRoadExtStatus(status: number) {
  return status === 429 || status >= 500;
}

export function openRoadExtRetryDelayMs(attempt: number, retryAfterHeader?: string | null) {
  if (retryAfterHeader) {
    const seconds = Number.parseFloat(retryAfterHeader);

    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, EXT_RETRY_MAX_DELAY_MS);
    }
  }

  return Math.min(EXT_RETRY_BASE_DELAY_MS * 2 ** attempt, EXT_RETRY_MAX_DELAY_MS);
}

/** Turns an upstream error response into an actionable `HttpError`. */
export function openRoadExtErrorFromResponse(path: string, status: number, body: unknown): HttpError {
  const envelope = (body && typeof body === "object" ? body : {}) as OpenRoadExtEnvelope<unknown>;
  const error = envelope.error;
  const requestId = envelope.meta?.request_id;
  const requestSuffix = requestId ? ` (request_id ${requestId})` : "";
  const detail = error?.message || error?.code;
  const mappedStatus = status >= 500 ? 502 : status;

  if (status === 401) {
    return new HttpError(
      `Open Road External API v1 credentials are invalid or expired — verify OPENROAD_EXT_CLIENT_ID / OPENROAD_EXT_CLIENT_SECRET${requestSuffix}`,
      mappedStatus,
    );
  }

  if (status === 403) {
    return new HttpError(
      `Open Road External API v1 access to ${path} was denied — this application is not granted that endpoint. Request the missing read grant from Open Road support (help@openroadtms.com)${requestSuffix}`,
      mappedStatus,
    );
  }

  if (status === 429) {
    return new HttpError(
      `Open Road External API v1 rate limit hit for ${path} — retry after the Retry-After delay${requestSuffix}`,
      mappedStatus,
    );
  }

  const detailSuffix = detail ? `: ${detail}` : "";
  return new HttpError(
    `Open Road External API v1 request to ${path} failed (${status})${detailSuffix}${requestSuffix}`,
    mappedStatus,
  );
}

export type OpenRoadExtRequestOptions = {
  path: string;
  query?: OpenRoadExtQuery;
  /** Injectable for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** Injectable for tests; defaults to a timer-based sleep. */
  sleep?: (ms: number) => Promise<void>;
  maxAttempts?: number;
  /** Injectable for tests; defaults to the env-derived Basic auth config. */
  runtime?: OpenRoadExtRuntime;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Performs one External API v1 request (with retries on network errors, 429,
 * and 5xx) and unwraps the `{ data, error, meta }` envelope.
 */
export async function openRoadExtRequest<TData>(
  options: OpenRoadExtRequestOptions,
): Promise<{ data: TData; meta: NonNullable<OpenRoadExtEnvelope<TData>["meta"]> }> {
  const runtime = options.runtime ?? getOpenRoadExtRuntimeConfig();
  const doFetch = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const maxAttempts = options.maxAttempts ?? DEFAULT_EXT_MAX_ATTEMPTS;
  const url = new URL(`${runtime.baseUrl}${options.path}`);

  for (const [key, value] of buildOpenRoadExtQuery(options.query).entries()) {
    url.searchParams.append(key, value);
  }

  let attempt = 0;

  while (true) {
    let response: Response;

    try {
      response = await doFetch(url, {
        headers: {
          Accept: "application/json",
          Authorization: runtime.authorization,
        },
      });
    } catch (error) {
      if (attempt + 1 >= maxAttempts) {
        const detail = error instanceof Error ? error.message : "network error";
        throw new HttpError(`Open Road External API v1 is unreachable: ${detail}`, 503);
      }

      await sleep(openRoadExtRetryDelayMs(attempt));
      attempt += 1;
      continue;
    }

    if (isRetryableOpenRoadExtStatus(response.status) && attempt + 1 < maxAttempts) {
      await sleep(openRoadExtRetryDelayMs(attempt, response.headers.get("retry-after")));
      attempt += 1;
      continue;
    }

    const body = (await response.json().catch(() => null)) as OpenRoadExtEnvelope<TData> | null;

    if (!response.ok) {
      throw openRoadExtErrorFromResponse(options.path, response.status, body);
    }

    if (!body || typeof body !== "object" || body.data == null) {
      throw new HttpError(
        `Open Road External API v1 returned an unexpected response for ${options.path}`,
        502,
      );
    }

    if (body.error) {
      const detail = body.error.message ?? body.error.code ?? "unknown error";
      throw new HttpError(`Open Road External API v1 request to ${options.path} failed: ${detail}`, 502);
    }

    return { data: body.data, meta: body.meta ?? {} };
  }
}

/**
 * Walks every page of a collection sequentially (the API asks clients not to
 * fetch pages in parallel) using `meta.total` plus a short-page stop condition.
 */
export async function fetchAllOpenRoadExtPages<TItem>(
  fetchPage: (page: number) => Promise<{ data: TItem[]; meta: { total?: number } }>,
): Promise<TItem[]> {
  const items: TItem[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const { data, meta } = await fetchPage(page);

    if (!Array.isArray(data)) {
      throw new HttpError("Open Road External API v1 returned an unexpected collection response", 502);
    }

    items.push(...data);

    const total = typeof meta.total === "number" && meta.total > 0 ? meta.total : items.length;
    totalPages = Math.max(1, Math.ceil(total / EXT_PAGE_SIZE));
    page += 1;
  } while (page <= totalPages && items.length > 0 && items.length % EXT_PAGE_SIZE === 0);

  return items;
}

function parseOpenRoadExtNumber(value?: string | number | null): number | undefined {
  if (value == null) {
    return undefined;
  }

  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** The External API returns numeric coordinates; the legacy type uses strings. */
function toLegacyCoordinate(value?: number | null): string | undefined {
  return value == null ? undefined : String(value);
}

export function mapOpenRoadExtDestination(destination: OpenRoadExtDestination): OpenRoadLoadDestination {
  return {
    id: destination.id,
    position: destination.position,
    stop_type: destination.stop_type,
    stop_company_name: destination.stop_company_name ?? undefined,
    address: destination.address ?? undefined,
    city: destination.city ?? undefined,
    state_code: destination.state_code ?? undefined,
    zip_code: destination.zip_code ?? undefined,
    phone: destination.phone ?? undefined,
    lat: toLegacyCoordinate(destination.lat),
    lng: toLegacyCoordinate(destination.lng),
    app_date: destination.app_date ?? undefined,
    time_from: destination.time_from ?? undefined,
    time_to: destination.time_to ?? undefined,
    time_in: destination.time_in ?? undefined,
    time_out: destination.time_out ?? undefined,
    on_time: destination.on_time ?? undefined,
    arrival_status: destination.arrival_status ?? undefined,
    completed: Boolean(destination.completed),
    driver_id: destination.driver_id ?? undefined,
    trailer_id: destination.trailer_id ?? undefined,
  };
}

export function mapOpenRoadExtLoad(load: OpenRoadExtLoad): OpenRoadLoad {
  return {
    id: load.id,
    status: load.status,
    customer_load: load.customer_load ?? undefined,
    company_load: load.gp_load ?? undefined,
    equipment: load.equipment ?? undefined,
    commodity: load.commodity ?? undefined,
    weight: parseOpenRoadExtNumber(load.weight),
    temperature: load.temperature || undefined,
    size: load.size ?? undefined,
    hot: Boolean(load.hot),
    customer_id: load.customer_id ?? undefined,
    customer_name: load.customer_name ?? undefined,
    destinations: (load.destinations ?? []).map(mapOpenRoadExtDestination),
  };
}

export function mapOpenRoadExtTruck(truck: OpenRoadExtTruck): OpenRoadTruck {
  return {
    id: truck.id,
    unit: truck.unit ?? "",
    status: truck.status,
    vin: truck.vin || undefined,
    make: truck.make || undefined,
    model: truck.model || undefined,
    year: truck.year ?? undefined,
    license_plate: truck.license_plate || undefined,
    state_code: truck.state_code || undefined,
    odometer: truck.odometer || undefined,
    fuel_tank_capacity_gallons: parseOpenRoadExtNumber(truck.fuel_tank_capacity),
  };
}

function buildDriverName(assignment: OpenRoadExtAssignment) {
  const name = [assignment.driver?.first_name, assignment.driver?.last_name].filter(Boolean).join(" ").trim();
  return name || undefined;
}

function buildAssignmentUnit(assignment: OpenRoadExtAssignment, equipment?: OpenRoadExtEquipmentSummary | null) {
  const unit = equipment?.unit?.trim();

  if (unit) {
    return unit;
  }

  return String(assignment.assignment_id);
}

export function mapOpenRoadExtAssignment(assignment: OpenRoadExtAssignment): OpenRoadAssignment {
  return {
    id: assignment.id,
    driver_id: assignment.driver_id,
    driver_name: buildDriverName(assignment),
    driver_nr: assignment.driver?.driver_nr ?? undefined,
    // Not exposed by the External API assignments endpoint — the sync service
    // backfills these from the driver roster.
    driver_phone: undefined,
    driver_team: undefined,
    driver_team_manager: undefined,
    assignment_id: assignment.assignment_id,
    assignment_type: assignment.assignment_type,
    assignment_unit: buildAssignmentUnit(assignment, assignment.assignment),
    start_date: assignment.start_date ?? undefined,
    end_date: assignment.end_date ?? null,
  };
}

/** Active loads — the replacement for the removed V2 `/active_loads`. */
export async function listOpenRoadExtActiveLoads() {
  const loads = await fetchAllOpenRoadExtPages<OpenRoadExtLoad>((page) =>
    openRoadExtRequest<OpenRoadExtLoad[]>({
      path: "/loads",
      query: {
        page,
        per_page: EXT_PAGE_SIZE,
        status: [...OPENROAD_EXT_ACTIVE_LOAD_STATUSES],
      },
    }),
  );

  return loads.map(mapOpenRoadExtLoad);
}

export async function listOpenRoadExtTrucks(status?: string) {
  const trucks = await fetchAllOpenRoadExtPages<OpenRoadExtTruck>((page) =>
    openRoadExtRequest<OpenRoadExtTruck[]>({
      path: "/trucks",
      query: {
        page,
        per_page: EXT_PAGE_SIZE,
        status,
      },
    }),
  );

  return trucks.map(mapOpenRoadExtTruck);
}

/**
 * Current driver-to-equipment assignments — the replacement for the removed
 * V2 `/assignments`. By default the External API returns only current rows
 * (`end_date` null or in the future), which matches the `isCurrent` semantics
 * of the sync service.
 */
export async function listOpenRoadExtAssignments(filters?: {
  driverId?: number;
  assignmentType?: "Truck" | "Trailer";
}) {
  const assignments = await fetchAllOpenRoadExtPages<OpenRoadExtAssignment>((page) =>
    openRoadExtRequest<OpenRoadExtAssignment[]>({
      path: "/assignments",
      query: {
        page,
        per_page: EXT_PAGE_SIZE,
        driver_id: filters?.driverId,
        assignment_type: filters?.assignmentType,
      },
    }),
  );

  return assignments.map(mapOpenRoadExtAssignment);
}

/**
 * Driver roster from External API v1. Prefer this when you need `manager_id`
 * (dispatcher → driver). Legacy V2 `/drivers` still has richer HR fields but
 * does not expose manager assignment.
 */
export async function listOpenRoadExtDrivers(filters?: {
  managerId?: number;
  status?: string | string[];
}) {
  return fetchAllOpenRoadExtPages<OpenRoadExtDriver>((page) =>
    openRoadExtRequest<OpenRoadExtDriver[]>({
      path: "/drivers",
      query: {
        page,
        per_page: EXT_PAGE_SIZE,
        manager_id: filters?.managerId,
        status: filters?.status,
      },
    }),
  );
}

/** Back-office users (dispatchers, admins, etc.) — used to resolve manager_id. */
export async function listOpenRoadExtUsers(filters?: {
  type?: string | string[];
  status?: string | string[];
}) {
  return fetchAllOpenRoadExtPages<OpenRoadExtUser>((page) =>
    openRoadExtRequest<OpenRoadExtUser[]>({
      path: "/users",
      query: {
        page,
        per_page: EXT_PAGE_SIZE,
        type: filters?.type,
        status: filters?.status,
      },
    }),
  );
}
