import { model, Schema } from "mongoose";

export type TmsLoadDestinationDocument = {
  openroadDestinationId: number;
  position: number;
  stopType: string;
  companyName?: string;
  address?: string;
  city?: string;
  stateCode?: string;
  zipCode?: string;
  lat?: number;
  lng?: number;
  appointmentDate?: string;
  timeFrom?: Date;
  timeTo?: Date;
  timeIn?: Date | null;
  timeOut?: Date | null;
  onTime?: boolean;
  arrivalStatus?: string | null;
  completed: boolean;
  driverId?: number;
};

export type TmsLoadDocument = {
  _id: unknown;
  openroadLoadId: number;
  status: string;
  customerLoad?: string;
  companyLoad?: string;
  equipment?: string;
  commodity?: string;
  weight?: number;
  customerName?: string;
  hot: boolean;
  destinations: TmsLoadDestinationDocument[];
  primaryDriverId?: number;
  truckUnit?: string;
  openroadTruckId?: number;
  originCity?: string;
  originStateCode?: string;
  destinationCity?: string;
  destinationStateCode?: string;
  isActive: boolean;
  syncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const loadDestinationSchema = new Schema<TmsLoadDestinationDocument>(
  {
    openroadDestinationId: { type: Number, required: true },
    position: { type: Number, required: true },
    stopType: { type: String, required: true, trim: true },
    companyName: { type: String, trim: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    stateCode: { type: String, trim: true },
    zipCode: { type: String, trim: true },
    lat: { type: Number },
    lng: { type: Number },
    appointmentDate: { type: String, trim: true },
    timeFrom: { type: Date },
    timeTo: { type: Date },
    timeIn: { type: Date, default: null },
    timeOut: { type: Date, default: null },
    onTime: { type: Boolean },
    arrivalStatus: { type: String, trim: true },
    completed: { type: Boolean, default: false },
    driverId: { type: Number },
  },
  { _id: false },
);

const tmsLoadSchema = new Schema<TmsLoadDocument>(
  {
    openroadLoadId: { type: Number, required: true, unique: true, index: true },
    status: { type: String, required: true, trim: true, index: true },
    customerLoad: { type: String, trim: true },
    companyLoad: { type: String, trim: true, index: true },
    equipment: { type: String, trim: true },
    commodity: { type: String, trim: true },
    weight: { type: Number },
    customerName: { type: String, trim: true },
    hot: { type: Boolean, default: false },
    destinations: { type: [loadDestinationSchema], default: [] },
    primaryDriverId: { type: Number, index: true },
    truckUnit: { type: String, trim: true, index: true },
    openroadTruckId: { type: Number, index: true },
    originCity: { type: String, trim: true },
    originStateCode: { type: String, trim: true },
    destinationCity: { type: String, trim: true },
    destinationStateCode: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },
    syncedAt: { type: Date },
  },
  { timestamps: true },
);

tmsLoadSchema.index({ truckUnit: 1, isActive: 1 });

export const TmsLoadModel = model<TmsLoadDocument>("TmsLoad", tmsLoadSchema);
