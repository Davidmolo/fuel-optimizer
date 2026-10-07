/**
 * Delete a Fuel Optimizer Trimble trip by alkTripId (clears tablet leftover).
 * Usage: node scripts/delete-fo-trip.mjs <alkTripId>
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const alkTripId = process.argv[2];
if (!alkTripId) {
  console.error("Usage: node scripts/delete-fo-trip.mjs <alkTripId>");
  process.exit(1);
}

const apiKey = process.env.TRIMBLE_API_KEY;
const baseUrl = (process.env.TRIMBLE_TRIP_MANAGEMENT_BASE_URL || "https://tripmanagement.trimblemaps.com/api").replace(
  /\/$/,
  "",
);

if (!apiKey) {
  console.error("TRIMBLE_API_KEY missing");
  process.exit(1);
}

const response = await fetch(`${baseUrl}/trip/${encodeURIComponent(alkTripId)}`, {
  method: "DELETE",
  headers: {
    Authorization: apiKey,
    Accept: "application/json",
  },
});

const text = await response.text();
if (!response.ok) {
  console.error(`Delete failed ${response.status}: ${text.slice(0, 300)}`);
  process.exit(1);
}

console.log(`Deleted Trimble trip ${alkTripId}`);
