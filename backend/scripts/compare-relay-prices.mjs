import mongoose from "mongoose";
await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/fuel-optimizer-local");
const db = mongoose.connection.db;
const txs = await db.collection("relayfueltransactions").find({ "raw.fuel_items.fuel_type_description": { $in: ["Diesel auto", "Diesel 1"] } }).toArray();
for (const tx of txs) {
  const items = (tx.raw.fuel_items || []).map((item) => `${item.fuel_type_description}:${item.discounted_price_per_unit}`);
  const station = await db.collection("fuelstations").findOne({ relayAccount: tx.relayAccount, relayLocationId: tx.locationId });
  console.log(JSON.stringify({
    account: tx.relayAccount,
    at: tx.occurredAt,
    items,
    stationDesc: station?.fuelTypeDescription,
    stationPrice: station?.discountedPricePerUnit,
    stationAt: station?.lastTransactionAt,
    stationTx: station?.lastTransactionId,
    thisTx: tx.transactionId,
  }));
}
await mongoose.disconnect();
