import { FuelLogModel } from "../models/fuel-log.model";

export type CreateFuelLogPayload = {
  vehicleId: string;
  liters: number;
  cost: number;
  odometer: number;
  filledAt: Date;
  note?: string;
};

export async function createFuelLog(payload: CreateFuelLogPayload) {
  const created = await FuelLogModel.create(payload);
  return created;
}

export async function listFuelLogs() {
  return FuelLogModel.find().sort({ filledAt: -1 }).lean();
}
