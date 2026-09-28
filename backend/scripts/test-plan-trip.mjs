/**
 * Live proof for Phase 1 Trimble trip planning.
 *
 * SAFETY:
 * - Plans only (status must be Planned)
 * - Never sends tspDriverId (no tablet notification)
 * - Only manages Fuel Optimizer trips (tmsTripId fo-*)
 * - Does not cancel, modify, or dispatch existing business trips
 *
 * Usage:
 *   npm run test:plan-trip -- <openroadLoadId>
 *   npm run test:plan-trip -- <openroadLoadId> --force
 *   API_BASE_URL=http://127.0.0.1:5000/api/v1 npm run test:plan-trip -- <openroadLoadId>
 *
 * Requires the backend to be running with TRIMBLE_API_KEY configured.
 */
const baseUrl = (process.env.API_BASE_URL || "http://127.0.0.1:5000/api/v1").replace(/\/$/, "");

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const force = args.includes("--force");
const loadId = args.find((arg) => arg !== "--force");

async function request(method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    payload,
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  console.log("Phase 1 Trimble plan-trip proof");
  console.log(`API: ${baseUrl}`);
  console.log("Safety: Planned only, no tspDriverId, no tablet notification");
  console.log("");

  if (!loadId) {
    throw new Error(
      "Usage: npm run test:plan-trip -- <openroadLoadId> [--force]\n" +
        "Pick a synced Open Road load that has at least two geocoded stops.",
    );
  }

  const health = await request("GET", "/health");
  assert(health.ok, `Health check failed: ${health.status}`);
  console.log("✓ health");

  const loadCheck = await request("GET", `/tms/loads/active/${encodeURIComponent(loadId)}`);
  if (!loadCheck.ok) {
    throw new Error(
      `Load ${loadId} was not found among active loads (${loadCheck.status}). ` +
        "Sync Open Road TMS first, then retry with a load that has lat/lng on at least two stops.",
    );
  }

  const destinations = loadCheck.payload?.data?.destinations || [];
  const geocodedCount = destinations.filter((stop) => Number.isFinite(stop.lat) && Number.isFinite(stop.lng)).length;
  assert(
    geocodedCount >= 2,
    `Load ${loadId} has only ${geocodedCount} geocoded stop(s). Need at least two before planning.`,
  );
  console.log(`✓ load ${loadId} has ${geocodedCount} geocoded stops`);

  const planPath = `/tms/loads/${encodeURIComponent(loadId)}/trimble-trip${force ? "?force=true" : ""}`;
  const planned = await request("POST", planPath, force ? { force: true } : {});
  assert(planned.ok, `Plan trip failed (${planned.status}): ${planned.payload?.message || JSON.stringify(planned.payload)}`);

  const data = planned.payload?.data;
  assert(data?.alkTripId, "Plan response missing alkTripId");
  assert(String(data.tripStatus) === "Planned", `Expected Planned status, got ${data.tripStatus}`);
  assert(
    data.tspDriverId == null || String(data.tspDriverId).trim() === "",
    `Safety failure: tspDriverId was set to ${data.tspDriverId}. Aborting — a tablet must not be notified.`,
  );
  assert(
    Number(data.routePathCoordinateCount) >= 2,
    `Expected route path coordinates >= 2, got ${data.routePathCoordinateCount}`,
  );
  assert(data.safety?.notifiesTablet === false, "safety.notifiesTablet must be false");
  assert(data.safety?.tspDriverIdAssigned === false, "safety.tspDriverIdAssigned must be false");
  assert(String(data.tmsTripId || "").startsWith("fo-"), `Expected fo-* tmsTripId, got ${data.tmsTripId}`);

  console.log("✓ planned trip");
  console.log(`  alkTripId: ${data.alkTripId}`);
  console.log(`  tmsTripId: ${data.tmsTripId}`);
  console.log(`  status: ${data.tripStatus}`);
  console.log(`  tspDriverId: (empty)`);
  console.log(`  miles: ${data.tripDistanceMiles ?? "n/a"}`);
  console.log(`  minutes: ${data.tripDurationMinutes ?? "n/a"}`);
  console.log(`  route coordinates: ${data.routePathCoordinateCount}`);
  console.log(`  reusedExisting: ${data.reusedExisting}`);
  if (data.tripUrl) {
    console.log(`  tripUrl: ${data.tripUrl}`);
  }

  const fetched = await request("GET", `/tms/loads/${encodeURIComponent(loadId)}/trimble-trip`);
  assert(fetched.ok, `GET trimble-trip failed (${fetched.status}): ${fetched.payload?.message || ""}`);
  assert(
    String(fetched.payload?.data?.alkTripId) === String(data.alkTripId),
    "GET alkTripId does not match the planned trip",
  );
  assert(String(fetched.payload?.data?.tripStatus) === "Planned", "GET status must remain Planned");
  assert(
    fetched.payload?.data?.tspDriverId == null || String(fetched.payload.data.tspDriverId).trim() === "",
    "GET response unexpectedly has tspDriverId",
  );
  console.log("✓ GET returns the same Planned trip with no driver assignment");

  console.log("");
  console.log("Phase 1 proof passed. No tablet was notified.");
}

main().catch((error) => {
  console.error("Phase 1 plan-trip proof failed:", error.message);
  process.exit(1);
});
