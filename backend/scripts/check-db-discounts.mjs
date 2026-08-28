import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const col = mongoose.connection.db.collection("fuelstations");

  const total = await col.countDocuments({});
  const withDiscount = await col.countDocuments({
    discountedPricePerUnit: { $exists: true, $ne: null },
  });
  const withRetail = await col.countDocuments({
    retailPricePerUnit: { $exists: true, $ne: null },
  });
  const lower = await col.countDocuments({
    $expr: { $lt: ["$discountedPricePerUnit", "$retailPricePerUnit"] },
  });
  const same = await col.countDocuments({
    $expr: { $eq: ["$discountedPricePerUnit", "$retailPricePerUnit"] },
  });
  const missingDiscount = await col.countDocuments({
    $or: [{ discountedPricePerUnit: { $exists: false } }, { discountedPricePerUnit: null }],
  });

  const sample = await col
    .find({ $expr: { $lt: ["$discountedPricePerUnit", "$retailPricePerUnit"] } })
    .sort({ syncedAt: -1 })
    .limit(5)
    .project({
      merchantName: 1,
      name: 1,
      retailPricePerUnit: 1,
      discountedPricePerUnit: 1,
      syncedAt: 1,
      lastTransactionAt: 1,
      relayAccount: 1,
    })
    .toArray();

  const staleNoSync = await col.countDocuments({
    isActive: true,
    $or: [{ syncedAt: { $exists: false } }, { syncedAt: null }],
  });

  const merchantContracts = mongoose.connection.db.collection("merchantcontracts");
  const contractCount = await merchantContracts.countDocuments({});
  const contractsWithZeroAdj = await merchantContracts.countDocuments({
    rateAdjustmentPerGallon: 0,
  });

  console.log(
    JSON.stringify(
      {
        fuelStations: {
          total,
          withDiscount,
          withRetail,
          discountedLowerThanRetail: lower,
          samePrice: same,
          missingDiscount,
          staleNoSync,
          pctWithDiscount: withRetail ? `${((lower / withRetail) * 100).toFixed(1)}%` : "n/a",
        },
        merchantContracts: {
          total: contractCount,
          withZeroAdjustment: contractsWithZeroAdj,
        },
        sampleDiscountedStations: sample.map((s) => ({
          ...s,
          savingsPerGal: +(s.retailPricePerUnit - s.discountedPricePerUnit).toFixed(3),
          syncedAt: s.syncedAt?.toISOString(),
          lastTransactionAt: s.lastTransactionAt?.toISOString(),
        })),
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
