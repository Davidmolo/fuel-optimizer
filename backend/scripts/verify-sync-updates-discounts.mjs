import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const API = "http://localhost:5000/api/v1";

async function getDbSnapshot() {
  await mongoose.connect(process.env.MONGODB_URI);
  const col = mongoose.connection.db.collection("fuelstations");

  const stations = await col
    .find({ isActive: true })
    .project({
      relayLocationId: 1,
      retailPricePerUnit: 1,
      discountedPricePerUnit: 1,
      syncedAt: 1,
      lastTransactionAt: 1,
    })
    .toArray();

  const map = new Map(
    stations.map((s) => [
      s.relayLocationId,
      {
        retail: s.retailPricePerUnit,
        discounted: s.discountedPricePerUnit,
        syncedAt: s.syncedAt?.toISOString() ?? null,
        lastTransactionAt: s.lastTransactionAt?.toISOString() ?? null,
      },
    ]),
  );

  await mongoose.disconnect();
  return map;
}

function diffSnapshots(before, after) {
  let priceChanged = 0;
  let syncTimeChanged = 0;
  let discountAdded = 0;
  let discountRemoved = 0;
  const examples = [];

  for (const [id, afterRow] of after) {
    const beforeRow = before.get(id);
    if (!beforeRow) continue;

    const retailChanged = beforeRow.retail !== afterRow.retail;
    const discountedChanged = beforeRow.discounted !== afterRow.discounted;
    const syncedChanged = beforeRow.syncedAt !== afterRow.syncedAt;

    if (retailChanged || discountedChanged) priceChanged++;
    if (syncedChanged) syncTimeChanged++;
    if (beforeRow.discounted == null && afterRow.discounted != null) discountAdded++;
    if (beforeRow.discounted != null && afterRow.discounted == null) discountRemoved++;

    if ((retailChanged || discountedChanged || syncedChanged) && examples.length < 5) {
      examples.push({
        relayLocationId: id,
        before: beforeRow,
        after: afterRow,
      });
    }
  }

  return { priceChanged, syncTimeChanged, discountAdded, discountRemoved, examples };
}

async function main() {
  const before = await getDbSnapshot();
  console.log("Before sync:", before.size, "active stations in DB");

  const syncRes = await fetch(`${API}/stations/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const syncJson = await syncRes.json();
  if (!syncJson.success) {
    throw new Error(`Sync failed: ${syncJson.message}`);
  }

  const after = await getDbSnapshot();
  const diff = diffSnapshots(before, after);

  console.log(
    JSON.stringify(
      {
        syncResult: {
          totalTransactionCount: syncJson.data.totalTransactionCount,
          totalStationCount: syncJson.data.totalStationCount,
          merchantContractsSynced: syncJson.data.merchantContracts?.merchantCount,
        },
        dbComparison: {
          stationsBefore: before.size,
          stationsAfter: after.size,
          pricesUpdated: diff.priceChanged,
          syncedAtUpdated: diff.syncTimeChanged,
          discountsAdded: diff.discountAdded,
          discountsRemoved: diff.discountRemoved,
        },
        examples: diff.examples,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
