import mongoose from "mongoose";
import { getRecommendationForTruck } from "../src/modules/recommendation/services/recommendation.service.ts";

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/fuel-optimizer-local";
await mongoose.connect(uri);
const db = mongoose.connection.db;

const vehicles = await db.collection("fleetvehicles").find({ "fuel.percent": { $exists: true } }).limit(10).toArray();
console.log(
  "Fleet with fuel:",
  vehicles.map((v) => ({
    unit: v.unitNumber,
    fuel: v.fuel?.percent,
    gps: v.gps ? `${v.gps.latitude},${v.gps.longitude}` : null,
    openroadTruckId: v.openroadTruckId,
  })),
);

const loads = await db
  .collection("tmsloads")
  .find({ isActive: true, truckUnit: { $exists: true, $ne: null } })
  .toArray();

for (const load of loads) {
  const geocoded = (load.destinations || []).filter((d) => d.lat && d.lng);
  if (!load.truckUnit) continue;
  try {
    const result = await getRecommendationForTruck(load.truckUnit);
    console.log({
      truckUnit: load.truckUnit,
      route: `${load.originCity} -> ${load.destinationCity}`,
      geocodedStops: geocoded.length,
      status: result.status,
      message: result.message?.slice(0, 80),
      corridorCount: result.corridorStations?.length ?? 0,
      filterStats: result.filterStats,
      fuelPercent: result.fuelRange?.fuelPercent,
      usableRange: result.fuelRange?.usableRangeMiles,
    });
  } catch (error) {
    console.log(load.truckUnit, error instanceof Error ? error.message : error);
  }
}

await mongoose.disconnect();
