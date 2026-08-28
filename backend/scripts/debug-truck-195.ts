import mongoose from "mongoose";
import { getRecommendationForTruck } from "../src/modules/recommendation/services/recommendation.service.ts";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/fuel-optimizer-local");
  const result = await getRecommendationForTruck("195");
  console.log(
    JSON.stringify(
      {
        status: result.status,
        message: result.message,
        searchMode: result.searchMode,
        corridorCount: result.corridorStations?.length ?? 0,
        primary: result.primary?.merchantDisplayName,
        price: result.primary?.effectivePricePerGallon,
        fuelRange: result.fuelRange,
      },
      null,
      2,
    ),
  );
  await mongoose.disconnect();
}

void main();
