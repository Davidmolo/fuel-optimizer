import mongoose from "mongoose";

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/fuel-optimizer-local";

await mongoose.connect(uri);
const db = mongoose.connection.db;

const stationStats = {
  active: await db.collection("fuelstations").countDocuments({ isActive: true }),
  withCoords: await db.collection("fuelstations").countDocuments({
    isActive: true,
    latitude: { $type: "number" },
    longitude: { $type: "number" },
  }),
  withDiscount: await db.collection("fuelstations").countDocuments({
    isActive: true,
    discountedPricePerUnit: { $gt: 0 },
  }),
};

const loads = await db.collection("tmsloads").find({ isActive: true }).limit(5).toArray();
const contracts = await db.collection("merchantcontracts").find({ isActive: true }).toArray();
console.log("Active contracts:", contracts.length);
console.log(
  "Pilot/Loves contracts:",
  contracts.filter((c) => /pilot|love/i.test(c.merchantKey)).map((c) => c.merchantKey),
);

await mongoose.disconnect();
