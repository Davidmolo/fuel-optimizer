import { model, Schema } from "mongoose";
import type { RelayAccount } from "../../../integrations/relay";

export type RelayFuelTransactionDocument = {
  relayAccount: RelayAccount;
  transactionId: string;
  locationId: string;
  merchantName?: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  amountPaid?: number;
  gallons?: number;
  occurredAt: Date;
  raw?: Record<string, unknown>;
  syncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const relayFuelTransactionSchema = new Schema<RelayFuelTransactionDocument>(
  {
    relayAccount: { type: String, required: true, enum: ["blue_stallion", "azfs"], index: true },
    transactionId: { type: String, required: true, trim: true },
    locationId: { type: String, required: true, trim: true, index: true },
    merchantName: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    latitude: { type: Number },
    longitude: { type: Number },
    amountPaid: { type: Number },
    gallons: { type: Number },
    occurredAt: { type: Date, required: true, index: true },
    raw: { type: Schema.Types.Mixed },
    syncedAt: { type: Date },
  },
  { timestamps: true },
);

relayFuelTransactionSchema.index({ relayAccount: 1, transactionId: 1 }, { unique: true });
relayFuelTransactionSchema.index({ relayAccount: 1, locationId: 1, occurredAt: 1 });

export const RelayFuelTransactionModel = model<RelayFuelTransactionDocument>(
  "RelayFuelTransaction",
  relayFuelTransactionSchema,
);
