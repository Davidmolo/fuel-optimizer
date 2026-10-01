/**
 * Live proof for Phase 2 Trimble trip dispatch to one CoPilot tablet.
 *
 * SAFETY:
 * - Only dispatches Fuel Optimizer trips (tmsTripId fo-*)
 * - Defaults to test tablet 999 with allowTestTablet=true
 * - Does not cancel or overwrite OpenRoad/CoPilot business trips
 *
 * Usage:
 *   npm run test:dispatch-trip -- <openroadLoadId>
 *   npm run test:dispatch-trip -- <openroadLoadId> --tablet 999
 *   API_BASE_URL=http://127.0.0.1:5000/api/v1 npm run test:dispatch-trip -- <openroadLoadId>
 *
 * Requires the backend to be running with TRIMBLE_API_KEY configured.
 * Coordinate with Mantas when ready so tablet 999 can accept the CoPilot popup.
 */
const baseUrl = (process.env.API_BASE_URL || "http://127.0.0.1:5000/api/v1").replace(/\/$/, "");

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const tabletFlagIndex = args.indexOf("--tablet");
const tabletId =
  tabletFlagIndex >= 0 && args[tabletFlagIndex + 1] ? String(args[tabletFlagIndex + 1]).trim() : "999";
const loadId = args.find((arg, index) => {
  if (arg === "--tablet") return false;
  if (tabletFlagIndex >= 0 && index === tabletFlagIndex + 1) return false;
  return true;
});

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
  console.log("Phase 2 Trimble dispatch-trip proof");
  console.log(`API: ${baseUrl}`);
  console.log(`Target tablet (tspDriverId): ${tabletId}`);
  console.log("Safety: fo-* trips only, allowTestTablet required for 999");
  console.log("");

  if (!loadId) {
    throw new Error(
      "Usage: npm run test:dispatch-trip -- <openroadLoadId> [--tablet 999]\n" +
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

  // Prefer an existing Planned trip with no driver. If already assigned to our test tablet, treat as success path.
  const existing = await request("GET", `/tms/loads/${encodeURIComponent(loadId)}/trimble-trip`);
  let plannedData = existing.ok ? existing.payload?.data : null;

  if (
    plannedData &&
    String(plannedData.tspDriverId || "").trim() === String(tabletId) &&
    ["Dispatched", "Planned", "InProgress", "ReceivedByClient"].includes(String(plannedData.tripStatus))
  ) {
    console.log("✓ trip already assigned to target tablet");
    console.log(`  alkTripId: ${plannedData.alkTripId}`);
    console.log(`  tmsTripId: ${plannedData.tmsTripId}`);
    console.log(`  status: ${plannedData.tripStatus}`);
    console.log(`  tspDriverId: ${plannedData.tspDriverId}`);
    if (plannedData.tripStatus === "Planned") {
      console.log("  note: status is still Planned — Dispatched usually needs CoPilot online with BackOfficeTripIntegrationEnabled=1");
    }
    console.log("");
    console.log("Phase 2 proof passed (API assignment). Ask Mantas to check tablet " + tabletId + " for the CoPilot popup.");
    if (plannedData.tripUrl) {
      console.log(`Trip URL for reference: ${plannedData.tripUrl}`);
    }
    return;
  }

  if (!plannedData || plannedData.tspDriverId) {
    const planned = await request("POST", `/tms/loads/${encodeURIComponent(loadId)}/trimble-trip?force=true`, {
      force: true,
    });
    assert(planned.ok, `Plan trip failed (${planned.status}): ${planned.payload?.message || JSON.stringify(planned.payload)}`);
    plannedData = planned.payload?.data;
  }

  assert(plannedData?.alkTripId, "Plan response missing alkTripId");
  assert(String(plannedData.tripStatus) === "Planned", `Expected Planned status before dispatch, got ${plannedData.tripStatus}`);
  assert(
    plannedData.tspDriverId == null || String(plannedData.tspDriverId).trim() === "",
    `Expected empty tspDriverId before dispatch, got ${plannedData.tspDriverId}`,
  );
  assert(String(plannedData.tmsTripId || "").startsWith("fo-"), `Expected fo-* tmsTripId, got ${plannedData.tmsTripId}`);
  console.log("✓ planned trip ready for dispatch");
  console.log(`  alkTripId: ${plannedData.alkTripId}`);
  console.log(`  tmsTripId: ${plannedData.tmsTripId}`);
  console.log(`  status: ${plannedData.tripStatus}`);

  const dispatched = await request("POST", `/tms/loads/${encodeURIComponent(loadId)}/trimble-trip/dispatch`, {
    tspDriverId: tabletId,
    allowTestTablet: true,
  });
  assert(
    dispatched.ok,
    `Dispatch failed (${dispatched.status}): ${dispatched.payload?.message || JSON.stringify(dispatched.payload)}`,
  );

  const data = dispatched.payload?.data;
  assert(data?.alkTripId, "Dispatch response missing alkTripId");
  assert(String(data.tspDriverId) === String(tabletId), `Expected tspDriverId=${tabletId}, got ${data.tspDriverId}`);
  assert(
    ["Dispatched", "Planned", "InProgress", "ReceivedByClient"].includes(String(data.tripStatus)),
    `Unexpected tripStatus after dispatch: ${data.tripStatus}`,
  );
  assert(data.safety?.notifiesTablet === true, "safety.notifiesTablet must be true after dispatch");
  assert(data.safety?.tspDriverIdAssigned === true, "safety.tspDriverIdAssigned must be true after dispatch");
  assert(String(data.tmsTripId || "").startsWith("fo-"), `Expected fo-* tmsTripId, got ${data.tmsTripId}`);

  console.log("✓ dispatched trip");
  console.log(`  alkTripId: ${data.alkTripId}`);
  console.log(`  tmsTripId: ${data.tmsTripId}`);
  console.log(`  status: Planned → ${data.tripStatus}`);
  console.log(`  tspDriverId: ${data.tspDriverId}`);
  console.log(`  reusedExisting: ${data.reusedExisting}`);
  if (data.tripStatus === "Planned") {
    console.log("  note: status is still Planned — Dispatched usually needs CoPilot online with BackOfficeTripIntegrationEnabled=1");
  }
  if (data.tripUrl) {
    console.log(`  tripUrl: ${data.tripUrl}`);
  }

  const fetched = await request("GET", `/tms/loads/${encodeURIComponent(loadId)}/trimble-trip`);
  assert(fetched.ok, `GET trimble-trip failed (${fetched.status}): ${fetched.payload?.message || ""}`);
  assert(
    String(fetched.payload?.data?.alkTripId) === String(data.alkTripId),
    "GET alkTripId does not match the dispatched trip",
  );
  assert(
    String(fetched.payload?.data?.tspDriverId) === String(tabletId),
    `GET tspDriverId must be ${tabletId}`,
  );
  console.log("✓ GET returns the same trip with tspDriverId assigned");

  console.log("");
  console.log("Phase 2 proof passed (API). Ask Mantas to check tablet " + tabletId + " for the CoPilot popup.");
  if (data.tripUrl) {
    console.log(`Trip URL for reference: ${data.tripUrl}`);
  }
}

main().catch((error) => {
  console.error("Phase 2 dispatch-trip proof failed:", error.message);
  process.exit(1);
});
