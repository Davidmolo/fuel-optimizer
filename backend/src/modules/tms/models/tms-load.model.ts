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

export type TmsLoadTrimbleTripDocument = {
  alkTripId: string;
  tmsTripId: string;
  tripStatus?: string;
  tspDriverId?: string | null;
  tripDistanceMiles?: number;
  tripDurationMinutes?: number;
  tripUrl?: string;
  plannedAt?: Date;
  refreshedAt?: Date;
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
  samsaraVehicleId?: string;
  originCity?: string;
  originStateCode?: string;
  destinationCity?: string;
  destinationStateCode?: string;
  isActive: boolean;
  /** Fuel Optimizer–owned Trip Management trip. Never used to overwrite OpenRoad/CoPilot business trips. */
  trimbleTrip?: TmsLoadTrimbleTripDocument;
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

const trimbleTripSchema = new Schema<TmsLoadTrimbleTripDocument>(
  {
    alkTripId: { type: String, required: true, trim: true, index: true },
    tmsTripId: { type: String, required: true, trim: true, index: true },
    tripStatus: { type: String, trim: true },
    tspDriverId: { type: String, trim: true, default: null },
    tripDistanceMiles: { type: Number },
    tripDurationMinutes: { type: Number },
    tripUrl: { type: String, trim: true },
    plannedAt: { type: Date },
    refreshedAt: { type: Date },
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
    samsaraVehicleId: { type: String, trim: true, index: true },
    originCity: { type: String, trim: true },
    originStateCode: { type: String, trim: true },
    destinationCity: { type: String, trim: true },
    destinationStateCode: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },
    trimbleTrip: { type: trimbleTripSchema },
    syncedAt: { type: Date },
  },
  { timestamps: true },
);

tmsLoadSchema.index({ truckUnit: 1, isActive: 1 });

export const TmsLoadModel = model<TmsLoadDocument>("TmsLoad", tmsLoadSchema);
