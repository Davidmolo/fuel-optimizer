/**
 * End-to-end smoke test for the recommendation API.
 *
 * Usage:
 *   node scripts/test-recommendations.mjs
 *   API_BASE_URL=http://127.0.0.1:5000/api/v1 node scripts/test-recommendations.mjs
 */
const baseUrl = (process.env.API_BASE_URL || "http://127.0.0.1:5000/api/v1").replace(/\/$/, "");

async function request(method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json();

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
  console.log(`Testing recommendations at ${baseUrl}`);

  const health = await request("GET", "/health");
  assert(health.ok, `Health check failed: ${health.status}`);
  console.log("✓ health");

  const missingTruckId = await request("GET", "/recommendations");
  assert(missingTruckId.status === 400, "Expected 400 when truckId is missing");
  console.log("✓ validation rejects missing truckId");

  const unknownTruck = await request("GET", "/recommendations/not-a-real-truck-99999");
  assert(unknownTruck.status === 404, "Expected 404 for unknown truck");
  console.log("✓ unknown truck returns 404");

  console.log("Syncing fleet telemetry...");
  const fleetSync = await request("POST", "/fleet/sync/telemetry");
  assert(fleetSync.ok, `Fleet sync failed: ${fleetSync.status}`);
  console.log("✓ fleet telemetry synced");

  const tripContexts = await request("GET", "/tms/trip-context");
  assert(tripContexts.ok, `Trip context fetch failed: ${tripContexts.status}`);

  const items = tripContexts.payload.data?.items || [];
  const readyLoads = items.filter((item) => item.linkage?.isReadyForRecommendation);
  console.log(`Ready loads: ${readyLoads.length}/${items.length}`);

  const samples = readyLoads.slice(0, 5);
  assert(samples.length > 0, "No ready loads available for recommendation testing");

  let readyCount = 0;
  let noCandidateCount = 0;
  let notReadyCount = 0;

  for (const sample of samples) {
    const identifier = sample.load.truckUnit || sample.vehicle?.unitNumber || sample.load.id;
    const byPath = await request("GET", `/recommendations/${encodeURIComponent(identifier)}`);
    const byQuery = await request("GET", `/recommendations?truckId=${encodeURIComponent(identifier)}`);

    assert(byPath.ok, `Recommendation by path failed for ${identifier}: ${byPath.status}`);
    assert(byQuery.ok, `Recommendation by query failed for ${identifier}: ${byQuery.status}`);
    assert(
      byPath.payload.data?.status === byQuery.payload.data?.status,
      `Path/query status mismatch for ${identifier}`,
    );

    const result = byPath.payload.data;
    const label = `${identifier} (${sample.load.routeLabel})`;

    if (result.status === "ready") {
      readyCount += 1;
      assert(result.primary, `Ready result missing primary for ${identifier}`);
      assert(
        typeof result.primary.effectivePricePerGallon === "number",
        `Primary price missing for ${identifier}`,
      );
      assert(result.fuelRange?.usableRangeMiles > 0, `Fuel range missing for ${identifier}`);
      assert(result.corridor?.pointCount >= 2, `Corridor too short for ${identifier}`);
      console.log(
        `✓ ${label} → ${result.primary.merchantDisplayName} @ $${result.primary.effectivePricePerGallon}/gal (${result.primary.distanceMiles} mi, ${result.alternates.length} alternates)`,
      );
      continue;
    }

    if (result.status === "no_candidates") {
      noCandidateCount += 1;
      assert(result.filterStats, `no_candidates missing filterStats for ${identifier}`);
      console.log(`~ ${label} → no candidates (${result.filterStats.candidates} matched)`);
      continue;
    }

    notReadyCount += 1;
    console.log(`~ ${label} → not_ready: ${result.message}`);
  }

  console.log("");
  console.log("Summary");
  console.log(`  ready: ${readyCount}`);
  console.log(`  no_candidates: ${noCandidateCount}`);
  console.log(`  not_ready: ${notReadyCount}`);
  assert(readyCount > 0, "Expected at least one ready recommendation in the sample set");

  console.log("");
  console.log("All recommendation smoke tests passed.");
}

main().catch((error) => {
  console.error("Recommendation smoke test failed:", error.message);
  process.exit(1);
});
