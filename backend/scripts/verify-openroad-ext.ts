/**
 * Live smoke test for the Open Road External API v1 migration.
 *
 * Runs the same client functions the sync jobs use and prints a summary.
 * Read-only — makes GET requests only. Run from backend/ with:
 *
 *   npx tsx scripts/verify-openroad-ext.ts
 *
 * Uses the credentials in .env.local (APP_ENV defaults to local).
 */

import {
  listOpenRoadDrivers,
  listOpenRoadExtActiveLoads,
  listOpenRoadExtAssignments,
  listOpenRoadExtTrucks,
} from "../src/integrations/openroad";

async function main() {
  console.log("== Open Road External API v1 smoke test ==");

  // The API asks clients to send one request at a time, so run sequentially.
  console.log("Fetching active loads...");
  const loads = await listOpenRoadExtActiveLoads();
  const firstLoad = loads[0];
  const firstLoadDestination = firstLoad?.destinations[0];
  console.log(`  active loads: ${loads.length}`);
  if (firstLoad) {
    console.log(
      `  first load: id=${firstLoad.id} status=${firstLoad.status} company_load=${firstLoad.company_load ?? "-"} weight=${firstLoad.weight ?? "-"} stops=${firstLoad.destinations.length}`,
    );
    console.log(
      `  first stop: type=${firstLoadDestination?.stop_type} city=${firstLoadDestination?.city ?? "-"} lat=${firstLoadDestination?.lat ?? "-"} lng=${firstLoadDestination?.lng ?? "-"} driver_id=${firstLoadDestination?.driver_id ?? "-"}`,
    );
  }

  console.log("Fetching active trucks...");
  const trucks = await listOpenRoadExtTrucks("active");
  const firstTruck = trucks[0];
  console.log(`  active trucks: ${trucks.length}`);
  if (firstTruck) {
    console.log(
      `  first truck: id=${firstTruck.id} unit=${firstTruck.unit} vin=${firstTruck.vin ?? "-"} tank_gallons=${firstTruck.fuel_tank_capacity_gallons ?? "-"}`,
    );
  }

  console.log("Fetching current truck assignments...");
  const assignments = await listOpenRoadExtAssignments({ assignmentType: "Truck" });
  const firstAssignment = assignments[0];
  console.log(`  current assignments: ${assignments.length}`);
  if (firstAssignment) {
    console.log(
      `  first assignment: id=${firstAssignment.id} driver=${firstAssignment.driver_name ?? "-"} (nr ${firstAssignment.driver_nr ?? "-"}) -> truck unit=${firstAssignment.assignment_unit} end_date=${firstAssignment.end_date ?? "null (current)"}`,
    );
  }

  console.log("Fetching driver roster (legacy V2 /drivers)...");
  const drivers = await listOpenRoadDrivers();
  console.log(`  drivers: ${drivers.length}`);
  const activeDrivers = drivers.filter((driver) => driver.status === "active").length;
  console.log(`  active drivers: ${activeDrivers}`);

  console.log("== smoke test complete ==");
}

main().catch((error) => {
  console.error("Smoke test failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
