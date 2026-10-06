/**
 * Live proof for Phase 3: attach automatic FuelStop, then dispatch-with-fuel to tablet 999.
 *
 * SAFETY:
 * - Only touches Fuel Optimizer trips (tmsTripId fo-*)
 * - Defaults to test tablet 999 with allowTestTablet=true
 * - Does not cancel OpenRoad/CoPilot business trips
 *
 * Usage:
 *   npm run test:fuel-stop-trip -- <openroadLoadId>
 *   npm run test:fuel-stop-trip -- <openroadLoadId> --tablet 999
 *   API_BASE_URL=http://127.0.0.1:5000/api/v1 npm run test:fuel-stop-trip -- <openroadLoadId>
 *
 * Requires the backend to be running with TRIMBLE_API_KEY configured.
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
  console.log("Phase 3 Trimble fuel-stop-trip proof");
  console.log(`API: ${baseUrl}`);
  console.log(`Target tablet (tspDriverId): ${tabletId}`);
  console.log("Safety: fo-* trips only, allowTestTablet required for 999");
  console.log("");

  if (!loadId) {
    throw new Error(
      "Usage: npm run test:fuel-stop-trip -- <openroadLoadId> [--tablet 999]\n" +
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

  // Fresh Planned trip so attach is not blocked by a prior Dispatched trip.
  const planned = await request("POST", `/tms/loads/${encodeURIComponent(loadId)}/trimble-trip?force=true`, {
    force: true,
  });
  assert(planned.ok, `Plan trip failed (${planned.status}): ${planned.payload?.message || JSON.stringify(planned.payload)}`);
  assert(String(planned.payload?.data?.tripStatus) === "Planned", `Expected Planned, got ${planned.payload?.data?.tripStatus}`);
  assert(String(planned.payload?.data?.tmsTripId || "").startsWith("fo-"), "Expected fo-* tmsTripId");
  console.log("✓ planned fresh FO trip");
  console.log(`  alkTripId: ${planned.payload.data.alkTripId}`);
  console.log(`  tmsTripId: ${planned.payload.data.tmsTripId}`);

  const fuelStop = await request("POST", `/tms/loads/${encodeURIComponent(loadId)}/trimble-trip/fuel-stop`, {});
  assert(
    fuelStop.ok,
    `Attach fuel stop failed (${fuelStop.status}): ${fuelStop.payload?.message || JSON.stringify(fuelStop.payload)}`,
  );

  const fuelData = fuelStop.payload?.data;
  assert(String(fuelData?.tripStatus) === "Planned", `Expected Planned after fuel-stop, got ${fuelData?.tripStatus}`);
  assert(
    fuelData?.tspDriverId == null || String(fuelData.tspDriverId).trim() === "",
    `Expected empty tspDriverId after fuel-stop attach, got ${fuelData?.tspDriverId}`,
  );
  assert(Array.isArray(fuelData?.stops) && fuelData.stops.length >= 2, "Expected persisted stops after fuel-stop");

  const hasFuelStopInList = fuelData.stops.some((stop) => stop.stopType === "FuelStop");
  if (fuelData.recommendation?.status === "ready") {
    assert(hasFuelStopInList, "Expected a FuelStop in stops when recommendation is ready");
    assert(fuelData.fuelStop?.relayLocationId, "Expected fuelStop record when recommendation is ready");
    console.log("✓ fuel stop attached");
    console.log(`  station: ${fuelData.fuelStop.merchantName || fuelData.fuelStop.name} @ ${fuelData.fuelStop.city || "?"}`);
    console.log(`  stopIndex: ${fuelData.fuelStop.stopIndex}`);
  } else {
    assert(!hasFuelStopInList, "Must not invent a FuelStop when recommendation is not ready");
    console.log(`✓ no contracted station — trip sent without FuelStop (${fuelData.recommendation?.status})`);
    console.log(`  message: ${fuelData.recommendation?.message || fuelData.lastRecommendationMessage}`);
  }

  const dispatched = await request("POST", `/tms/loads/${encodeURIComponent(loadId)}/trimble-trip/dispatch-with-fuel`, {
    tspDriverId: tabletId,
    allowTestTablet: true,
    useReplanDispatch: true,
  });
  assert(
    dispatched.ok,
    `Dispatch-with-fuel failed (${dispatched.status}): ${dispatched.payload?.message || JSON.stringify(dispatched.payload)}`,
  );

  const data = dispatched.payload?.data;
  assert(data?.alkTripId, "Dispatch response missing alkTripId");
  assert(String(data.tspDriverId) === String(tabletId), `Expected tspDriverId=${tabletId}, got ${data.tspDriverId}`);
  assert(
    ["Dispatched", "Planned", "InProgress", "ReceivedByClient"].includes(String(data.tripStatus)),
    `Unexpected tripStatus after dispatch: ${data.tripStatus}`,
  );
  assert(String(data.tmsTripId || "").startsWith("fo-"), `Expected fo-* tmsTripId, got ${data.tmsTripId}`);

  if (data.recommendation?.status === "ready" || data.fuelStop) {
    const stillHasFuel = Array.isArray(data.stops) && data.stops.some((stop) => stop.stopType === "FuelStop");
    assert(stillHasFuel || data.fuelStop, "FuelStop should remain after dispatch-with-fuel");
  }

  console.log("✓ dispatched with fuel path");
  console.log(`  alkTripId: ${data.alkTripId}`);
  console.log(`  tmsTripId: ${data.tmsTripId}`);
  console.log(`  status: ${data.tripStatus}`);
  console.log(`  tspDriverId: ${data.tspDriverId}`);

  const routePath = await request("GET", `/tms/loads/${encodeURIComponent(loadId)}/trimble-trip/route-path`);
  assert(routePath.ok, `GET route-path failed (${routePath.status}): ${routePath.payload?.message || ""}`);
  assert(
    Array.isArray(routePath.payload?.data?.polyline) && routePath.payload.data.polyline.length >= 2,
    "Expected Trimble route path polyline with at least 2 points",
  );
  console.log(`✓ route-path returned ${routePath.payload.data.polyline.length} coordinates`);

  console.log("");
  console.log("Phase 3 proof passed (API). Ask Mantas to check tablet " + tabletId + " for the CoPilot popup with fuel stop.");
  if (data.tripUrl) {
    console.log(`Trip URL for reference: ${data.tripUrl}`);
  }
}

main().catch((error) => {
  console.error("Phase 3 fuel-stop-trip proof failed:", error.message);
  process.exit(1);
});
