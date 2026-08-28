import { model, Schema } from "mongoose";

export type FleetMappingStatus = "linked" | "samsara_only" | "openroad_only" | "conflict";

export type FleetGpsTelemetry = {
  latitude: number;
  longitude: number;
  headingDegrees?: number;
  speedMilesPerHour?: number;
  formattedLocation?: string;
  addressName?: string;
  recordedAt: Date;
};

export type FleetFuelTelemetry = {
  percent: number;
  recordedAt: Date;
};

export type FleetVehicleDocument = {
  samsaraId?: string;
  openroadTruckId?: number;
  unitNumber: string;
  vin?: string;
  make?: string;
  model?: string;
  year?: string;
  licensePlate?: string;
  fuelTankCapacityGallons?: number;
  externalIds: Record<string, string>;
  openroadStatus?: string;
  mappingStatus: FleetMappingStatus;
  isActive: boolean;
  gps?: FleetGpsTelemetry;
  fuel?: FleetFuelTelemetry;
  registrySyncedAt?: Date;
  telemetrySyncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const gpsTelemetrySchema = new Schema<FleetGpsTelemetry>(
  {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    headingDegrees: { type: Number },
    speedMilesPerHour: { type: Number },
    formattedLocation: { type: String, trim: true },
    addressName: { type: String, trim: true },
    recordedAt: { type: Date, required: true },
  },
  { _id: false },
);

const fuelTelemetrySchema = new Schema<FleetFuelTelemetry>(
  {
    percent: { type: Number, required: true, min: 0, max: 100 },
    recordedAt: { type: Date, required: true },
  },
  { _id: false },
);

const fleetVehicleSchema = new Schema<FleetVehicleDocument>(
  {
    samsaraId: { type: String, unique: true, sparse: true, trim: true, index: true },
    openroadTruckId: { type: Number, unique: true, sparse: true, index: true },
    unitNumber: { type: String, required: true, trim: true, index: true },
    vin: { type: String, trim: true, uppercase: true, index: true },
    make: { type: String, trim: true },
    model: { type: String, trim: true },
    year: { type: String, trim: true },
    licensePlate: { type: String, trim: true },
    fuelTankCapacityGallons: { type: Number, min: 0 },
    externalIds: { type: Schema.Types.Mixed, default: {} },
    openroadStatus: { type: String, trim: true },
    mappingStatus: {
      type: String,
      enum: ["linked", "samsara_only", "openroad_only", "conflict"],
      default: "samsara_only",
      index: true,
    },
    isActive: { type: Boolean, default: true, index: true },
    gps: { type: gpsTelemetrySchema },
    fuel: { type: fuelTelemetrySchema },
    registrySyncedAt: { type: Date },
    telemetrySyncedAt: { type: Date },
  },
  { timestamps: true },
);

fleetVehicleSchema.index({ unitNumber: 1, isActive: 1 });

export const FleetVehicleModel = model<FleetVehicleDocument>("FleetVehicle", fleetVehicleSchema);
