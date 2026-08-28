import { model, Schema } from "mongoose";

export type TmsAssignmentDocument = {
  openroadAssignmentId: number;
  openroadDriverId: number;
  driverName?: string;
  driverNr?: string;
  driverPhone?: string;
  driverTeam?: string;
  openroadTruckId: number;
  truckUnit: string;
  assignmentType: string;
  startDate?: Date;
  endDate?: Date | null;
  isCurrent: boolean;
  syncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const tmsAssignmentSchema = new Schema<TmsAssignmentDocument>(
  {
    openroadAssignmentId: { type: Number, required: true, unique: true, index: true },
    openroadDriverId: { type: Number, required: true, index: true },
    driverName: { type: String, trim: true },
    driverNr: { type: String, trim: true },
    driverPhone: { type: String, trim: true },
    driverTeam: { type: String, trim: true },
    openroadTruckId: { type: Number, required: true, index: true },
    truckUnit: { type: String, required: true, trim: true, index: true },
    assignmentType: { type: String, required: true, trim: true },
    startDate: { type: Date },
    endDate: { type: Date, default: null },
    isCurrent: { type: Boolean, default: true, index: true },
    syncedAt: { type: Date },
  },
  { timestamps: true },
);

tmsAssignmentSchema.index({ openroadDriverId: 1, isCurrent: 1 });
tmsAssignmentSchema.index({ truckUnit: 1, isCurrent: 1 });

export const TmsAssignmentModel = model<TmsAssignmentDocument>("TmsAssignment", tmsAssignmentSchema);
