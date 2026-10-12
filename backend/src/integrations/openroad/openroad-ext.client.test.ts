import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  OPENROAD_EXT_ACTIVE_LOAD_STATUSES,
  buildOpenRoadExtQuery,
  fetchAllOpenRoadExtPages,
  isRetryableOpenRoadExtStatus,
  mapOpenRoadExtAssignment,
  mapOpenRoadExtLoad,
  mapOpenRoadExtTruck,
  openRoadExtErrorFromResponse,
  openRoadExtRequest,
  openRoadExtRetryDelayMs,
} from "./openroad-ext.client";
import type { OpenRoadExtAssignment, OpenRoadExtLoad, OpenRoadExtTruck } from "./openroad-ext.types";

const TEST_RUNTIME = {
  baseUrl: "https://openroad.test/api/ext/v1",
  authorization: "Basic dGVzdC1jbGllbnQ6dGVzdC1zZWNyZXQ=",
};

function envelopeResponse(body: unknown, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers });
}

describe("buildOpenRoadExtQuery", () => {
  it("emits multi-value filters with the bracket form", () => {
    const params = buildOpenRoadExtQuery({
      page: 2,
      per_page: 100,
      status: ["picked_up", "en_route_to_consignee"],
    });

    assert.equal(params.toString(), "page=2&per_page=100&status%5B%5D=picked_up&status%5B%5D=en_route_to_consignee");
  });

  it("skips undefined, null, and empty values", () => {
    const params = buildOpenRoadExtQuery({
      page: 1,
      status: undefined,
      driver_id: null as unknown as undefined,
      assignment_type: "",
    });

    assert.equal(params.toString(), "page=1");
  });

  it("keeps scalar values as single params", () => {
    const params = buildOpenRoadExtQuery({ assignment_type: "Truck" });
    assert.equal(params.getAll("assignment_type").length, 1);
    assert.equal(params.get("assignment_type"), "Truck");
  });
});

describe("mapOpenRoadExtLoad", () => {
  const load: OpenRoadExtLoad = {
    id: 2349291,
    status: "en_route_to_shipper",
    customer_load: "406408",
    gp_load: "2610-00354",
    customer_id: 15633,
    customer_name: "American Logistics Group",
    equipment: "Dry Van",
    commodity: "15 SHINGLES",
    weight: "44,500.0",
    size: "FTL",
    temperature: "",
    hot: false,
    destinations: [
      {
        id: 4864302,
        position: 1,
        stop_type: "pick_up",
        stop_company_name: "-",
        address: "7570 Hwy 78",
        city: "Dora",
        state_code: "AL",
        zip_code: "35062",
        lat: 33.7296534,
        lng: -87.0150024,
        app_date: "2026-10-09",
        time_from: "2026-10-09T05:00:00Z",
        time_to: "2026-10-09T05:00:00Z",
        time_in: null,
        time_out: null,
        on_time: true,
        arrival_status: null,
        completed: false,
        driver_id: 20506,
        trailer_id: null,
      },
    ],
  };

  it("maps gp_load onto the legacy company_load field", () => {
    const mapped = mapOpenRoadExtLoad(load);
    assert.equal(mapped.company_load, "2610-00354");
    assert.equal(mapped.customer_load, "406408");
  });

  it("normalizes comma-formatted string weight to a number", () => {
    const mapped = mapOpenRoadExtLoad(load);
    assert.equal(mapped.weight, 44500);
  });

  it("converts numeric coordinates to strings and drops empty temperature", () => {
    const mapped = mapOpenRoadExtLoad(load);
    const destination = mapped.destinations[0]!;

    assert.equal(destination.lat, "33.7296534");
    assert.equal(destination.lng, "-87.0150024");
    assert.equal(destination.stop_type, "pick_up");
    assert.equal(destination.driver_id, 20506);
    assert.equal(mapped.temperature, undefined);
    assert.equal(mapped.hot, false);
  });

  it("returns an empty destinations array when the API sends none", () => {
    const mapped = mapOpenRoadExtLoad({ ...load, destinations: null });
    assert.deepEqual(mapped.destinations, []);
  });
});

describe("mapOpenRoadExtTruck", () => {
  it("parses fuel_tank_capacity and passes odometer through", () => {
    const truck: OpenRoadExtTruck = {
      id: 1637,
      unit: "101",
      status: "active",
      vin: "4V4NC9EH7EN148497",
      make: "Volvo",
      model: "670",
      year: 2014,
      license_plate: "P 963448",
      state_code: "IL",
      odometer: "895455.47",
      fuel_tank_capacity: "240",
    };

    const mapped = mapOpenRoadExtTruck(truck);
    assert.equal(mapped.fuel_tank_capacity_gallons, 240);
    assert.equal(mapped.odometer, "895455.47");
    assert.equal(mapped.unit, "101");
  });

  it("treats an empty fuel_tank_capacity as undefined", () => {
    const mapped = mapOpenRoadExtTruck({
      id: 2,
      unit: "102",
      status: "active",
      fuel_tank_capacity: "",
    });

    assert.equal(mapped.fuel_tank_capacity_gallons, undefined);
  });
});

describe("mapOpenRoadExtAssignment", () => {
  it("maps the embedded driver and equipment summaries", () => {
    const assignment: OpenRoadExtAssignment = {
      id: 616813,
      driver_id: 40518,
      assignment_id: 14718,
      assignment_type: "Truck",
      start_date: "2026-10-08T20:38:00Z",
      end_date: null,
      driver: { id: 40518, first_name: "Craig", last_name: "Greene", driver_nr: "1033", status: "active" },
      assignment: { id: 14718, unit: "254", year: 2026, make: "Volvo", model: "VNL 860" },
    };

    const mapped = mapOpenRoadExtAssignment(assignment);

    assert.equal(mapped.driver_name, "Craig Greene");
    assert.equal(mapped.driver_nr, "1033");
    assert.equal(mapped.assignment_unit, "254");
    assert.equal(mapped.assignment_id, 14718);
    assert.equal(mapped.end_date, null);
    // Phone/team are backfilled by the sync service from the driver roster.
    assert.equal(mapped.driver_phone, undefined);
    assert.equal(mapped.driver_team, undefined);
  });

  it("falls back to the assignment id as unit when the summary has none", () => {
    const mapped = mapOpenRoadExtAssignment({
      id: 1,
      driver_id: 2,
      assignment_id: 14718,
      assignment_type: "Truck",
      end_date: null,
      driver: null,
      assignment: { id: 14718, unit: null },
    });

    assert.equal(mapped.assignment_unit, "14718");
    assert.equal(mapped.driver_name, undefined);
  });
});

describe("openRoadExtErrorFromResponse", () => {
  it("explains invalid credentials on 401", () => {
    const error = openRoadExtErrorFromResponse("/loads", 401, {
      data: null,
      error: { code: "unauthorized", message: "Invalid credentials", details: [] },
      meta: { request_id: "req-1" },
    });

    assert.match(error.message, /credentials are invalid or expired/);
    assert.match(error.message, /OPENROAD_EXT_CLIENT_ID/);
    assert.match(error.message, /request_id req-1/);
  });

  it("names the missing grant on 403", () => {
    const error = openRoadExtErrorFromResponse("/trucks", 403, {
      data: null,
      error: { code: "forbidden", message: "forbidden", details: [] },
    });

    assert.match(error.message, /access to \/trucks was denied/);
    assert.match(error.message, /help@openroadtms\.com/);
  });

  it("includes path, status, and detail for other failures", () => {
    const error = openRoadExtErrorFromResponse("/loads", 404, {
      data: null,
      error: { code: "not_found", message: "Not Found", details: [] },
    });

    assert.match(error.message, /request to \/loads failed \(404\): Not Found/);
    assert.equal(error.statusCode, 404);
  });

  it("maps upstream 5xx to 502", () => {
    const error = openRoadExtErrorFromResponse("/loads", 503, null);
    assert.equal(error.statusCode, 502);
  });
});

describe("retry behavior", () => {
  it("retries 429 and 5xx statuses", () => {
    assert.equal(isRetryableOpenRoadExtStatus(429), true);
    assert.equal(isRetryableOpenRoadExtStatus(500), true);
    assert.equal(isRetryableOpenRoadExtStatus(503), true);
    assert.equal(isRetryableOpenRoadExtStatus(404), false);
    assert.equal(isRetryableOpenRoadExtStatus(401), false);
  });

  it("backs off exponentially and honors Retry-After", () => {
    assert.equal(openRoadExtRetryDelayMs(0), 500);
    assert.equal(openRoadExtRetryDelayMs(1), 1000);
    assert.equal(openRoadExtRetryDelayMs(2), 2000);
    assert.equal(openRoadExtRetryDelayMs(0, "2"), 2000);
    assert.equal(openRoadExtRetryDelayMs(5, "120"), 30_000);
  });
});

describe("openRoadExtRequest", () => {
  it("sends the Basic authorization header and unwraps the envelope", async () => {
    let seenUrl: URL | undefined;
    let seenHeaders: Headers | undefined;

    const data = await openRoadExtRequest<{ ok: boolean }>({
      path: "/health",
      fetchImpl: async (input, init) => {
        seenUrl = new URL(String(input));
        seenHeaders = new Headers(init?.headers);
        return envelopeResponse({ data: { ok: true }, error: null, meta: { request_id: "r" } });
      },
      runtime: TEST_RUNTIME,
    });

    assert.equal(data.data.ok, true);
    assert.equal(String(seenUrl), "https://openroad.test/api/ext/v1/health");
    assert.equal(seenHeaders?.get("Authorization"), TEST_RUNTIME.authorization);
  });

  it("appends bracket-form multi-value query params to the URL", async () => {
    let seenUrl: URL | undefined;

    await openRoadExtRequest<unknown[]>({
      path: "/loads",
      query: { status: ["picked_up", "delayed"], per_page: 100 },
      fetchImpl: async (input) => {
        seenUrl = new URL(String(input));
        return envelopeResponse({ data: [], error: null, meta: { total: 0 } });
      },
      runtime: TEST_RUNTIME,
    });

    assert.deepEqual(seenUrl?.searchParams.getAll("status[]"), ["picked_up", "delayed"]);
  });

  it("retries a 500 response and succeeds on the next attempt", async () => {
    const sleeps: number[] = [];
    let calls = 0;

    const result = await openRoadExtRequest<string[]>({
      path: "/loads",
      fetchImpl: async () => {
        calls += 1;
        if (calls === 1) {
          return envelopeResponse({ data: null, error: { code: "internal_error" } }, 500);
        }
        return envelopeResponse({ data: ["load-1"], error: null, meta: { total: 1 } });
      },
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      runtime: TEST_RUNTIME,
    });

    assert.deepEqual(result.data, ["load-1"]);
    assert.equal(calls, 2);
    assert.deepEqual(sleeps, [500]);
  });

  it("retries network errors and surfaces a clear message after the last attempt", async () => {
    const sleeps: number[] = [];
    let calls = 0;

    await assert.rejects(
      openRoadExtRequest<unknown[]>({
        path: "/loads",
        fetchImpl: async () => {
          calls += 1;
          throw new Error("fetch failed");
        },
        sleep: async (ms) => {
          sleeps.push(ms);
        },
        runtime: TEST_RUNTIME,
      }),
      /Open Road External API v1 is unreachable: fetch failed/,
    );

    assert.equal(calls, 3);
    assert.deepEqual(sleeps, [500, 1000]);
  });

  it("throws the mapped 401 error without retrying", async () => {
    let calls = 0;

    await assert.rejects(
      openRoadExtRequest<unknown[]>({
        path: "/loads",
        fetchImpl: async () => {
          calls += 1;
          return envelopeResponse(
            { data: null, error: { code: "unauthorized", message: "Invalid credentials" }, meta: {} },
            401,
          );
        },
        runtime: TEST_RUNTIME,
      }),
      /credentials are invalid or expired/,
    );

    assert.equal(calls, 1);
  });
});

describe("fetchAllOpenRoadExtPages", () => {
  it("walks pages until the collection ends", async () => {
    const requestedPages: number[] = [];
    const items = await fetchAllOpenRoadExtPages<string>(async (page) => {
      requestedPages.push(page);

      if (page === 1) {
        return { data: Array.from({ length: 100 }, (_, i) => `item-${i}`), meta: { total: 150 } };
      }

      return { data: ["item-100", "item-101"], meta: { total: 150 } };
    });

    assert.equal(items.length, 102);
    assert.deepEqual(requestedPages, [1, 2]);
  });

  it("stops after one page when the first page is short", async () => {
    const requestedPages: number[] = [];
    const items = await fetchAllOpenRoadExtPages<string>(async (page) => {
      requestedPages.push(page);
      return { data: ["only-item"], meta: { total: 1 } };
    });

    assert.deepEqual(items, ["only-item"]);
    assert.deepEqual(requestedPages, [1]);
  });
});

describe("OPENROAD_EXT_ACTIVE_LOAD_STATUSES", () => {
  it("covers the delivering statuses and excludes terminal or unassigned states", () => {
    const statuses = new Set<string>(OPENROAD_EXT_ACTIVE_LOAD_STATUSES);

    for (const active of ["assigned", "en_route_to_shipper", "at_shipper", "picked_up", "delayed", "en_route_to_consignee", "at_consignee"]) {
      assert.ok(statuses.has(active), `missing active status ${active}`);
    }

    for (const inactive of ["delivered", "billed", "closed", "canceled", "booked", "tonu"]) {
      assert.ok(!statuses.has(inactive), `terminal status ${inactive} must not be treated as active`);
    }
  });
});
