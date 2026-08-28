import { model, Schema } from "mongoose";
import type { RelayAccount } from "../../../integrations/relay";

export type FuelStationDocument = {
  relayAccount: RelayAccount;
  relayLocationId: string;
  merchantName?: string;
  merchantNumber?: string;
  name?: string;
  fuelMerchantLocationId?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  opisId?: string;
  timezone?: string;
  fuelType?: string;
  fuelTypeDescription?: string;
  retailPricePerUnit?: number;
  discountedPricePerUnit?: number;
  lastTransactionAt?: Date;
  lastTransactionId?: string;
  isActive: boolean;
  syncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const fuelStationSchema = new Schema<FuelStationDocument>(
  {
    relayAccount: { type: String, required: true, enum: ["blue_stallion", "azfs"], index: true },
    relayLocationId: { type: String, required: true, trim: true, index: true },
    merchantName: { type: String, trim: true, index: true },
    merchantNumber: { type: String, trim: true },
    name: { type: String, trim: true },
    fuelMerchantLocationId: { type: String, trim: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true, index: true },
    zipCode: { type: String, trim: true },
    latitude: { type: Number },
    longitude: { type: Number },
    opisId: { type: String, trim: true, index: true },
    timezone: { type: String, trim: true },
    fuelType: { type: String, trim: true },
    fuelTypeDescription: { type: String, trim: true },
    retailPricePerUnit: { type: Number },
    discountedPricePerUnit: { type: Number },
    lastTransactionAt: { type: Date, index: true },
    lastTransactionId: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },
    syncedAt: { type: Date },
  },
  { timestamps: true },
);

fuelStationSchema.index({ relayAccount: 1, relayLocationId: 1 }, { unique: true });
fuelStationSchema.index({ merchantName: 1, state: 1 });

export const FuelStationModel = model<FuelStationDocument>("FuelStation", fuelStationSchema);
