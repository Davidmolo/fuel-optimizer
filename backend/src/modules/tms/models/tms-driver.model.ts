import { model, Schema } from "mongoose";

export type TmsDriverDocument = {
  openroadDriverId: number;
  employeeNr?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  phone?: string;
  email?: string;
  status?: string;
  position?: string;
  terminal?: string;
  team?: string;
  /** OpenRoad `/users` id of the driver's primary manager (dispatcher). */
  openroadManagerId?: number | null;
  /** Display label for the primary manager (for filters / fleet UI). */
  openroadManagerName?: string | null;
  isActive: boolean;
  syncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const tmsDriverSchema = new Schema<TmsDriverDocument>(
  {
    openroadDriverId: { type: Number, required: true, unique: true, index: true },
    employeeNr: { type: String, trim: true, index: true },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    displayName: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true },
    status: { type: String, trim: true },
    position: { type: String, trim: true },
    terminal: { type: String, trim: true },
    team: { type: String, trim: true },
    openroadManagerId: { type: Number, default: null, index: true },
    openroadManagerName: { type: String, trim: true, default: null, index: true },
    isActive: { type: Boolean, default: true, index: true },
    syncedAt: { type: Date },
  },
  { timestamps: true },
);

export const TmsDriverModel = model<TmsDriverDocument>("TmsDriver", tmsDriverSchema);
