import { model, Schema } from "mongoose";

export type FuelLogDocument = {
  vehicleId: string;
  liters: number;
  cost: number;
  odometer: number;
  filledAt: Date;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
};

const fuelLogSchema = new Schema<FuelLogDocument>(
  {
    vehicleId: { type: String, required: true, trim: true },
    liters: { type: Number, required: true, min: 0 },
    cost: { type: Number, required: true, min: 0 },
    odometer: { type: Number, required: true, min: 0 },
    filledAt: { type: Date, required: true },
    note: { type: String, trim: true },
  },
  { timestamps: true },
);

export const FuelLogModel = model<FuelLogDocument>("FuelLog", fuelLogSchema);
