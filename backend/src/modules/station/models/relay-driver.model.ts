import { model, Schema } from "mongoose";
import type { RelayAccount } from "../../../integrations/relay";

export type RelayDriverDataField = {
  fieldName: string;
  fieldValue: string;
};

export type RelayDriverDocument = {
  relayAccount: RelayAccount;
  relayDriverId: string;
  integrationId?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  phone?: string;
  email?: string;
  dataFields: RelayDriverDataField[];
  driverNumber?: string;
  truckNumber?: string;
  companyName?: string;
  isActive: boolean;
  syncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const relayDriverDataFieldSchema = new Schema<RelayDriverDataField>(
  {
    fieldName: { type: String, required: true, trim: true },
    fieldValue: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const relayDriverSchema = new Schema<RelayDriverDocument>(
  {
    relayAccount: { type: String, required: true, enum: ["blue_stallion", "azfs"], index: true },
    relayDriverId: { type: String, required: true, trim: true, index: true },
    integrationId: { type: String, trim: true, index: true },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    displayName: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true },
    dataFields: { type: [relayDriverDataFieldSchema], default: [] },
    driverNumber: { type: String, trim: true, index: true },
    truckNumber: { type: String, trim: true, index: true },
    companyName: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },
    syncedAt: { type: Date },
  },
  { timestamps: true },
);

relayDriverSchema.index({ relayAccount: 1, relayDriverId: 1 }, { unique: true });

export const RelayDriverModel = model<RelayDriverDocument>("RelayDriver", relayDriverSchema);
