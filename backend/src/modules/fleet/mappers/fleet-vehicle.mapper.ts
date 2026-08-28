import type { FleetFuelTelemetry, FleetGpsTelemetry, FleetMappingStatus } from "../models/fleet-vehicle.model";
import { LOW_FUEL_PERCENT_THRESHOLD } from "../constants";

export type TelemetryFreshness = "live" | "stale" | "missing";

export type FleetVehicleView = {
  id: string;
  samsaraId?: string;
  openroadTruckId?: number;
  unitNumber: string;
  vin?: string;
  make?: string;
  model?: string;
  year?: string;
  licensePlate?: string;
  fuelTankCapacityGallons?: number;
  openroadStatus?: string;
  mappingStatus: FleetMappingStatus;
  isActive: boolean;
  gps?: FleetGpsTelemetry & { freshness: TelemetryFreshness };
  fuel?: FleetFuelTelemetry & { freshness: TelemetryFreshness; isLow: boolean };
  registrySyncedAt?: string;
  telemetrySyncedAt?: string;
  updatedAt: string;
};

function getFreshness(recordedAt: Date | undefined, staleThresholdMs: number): TelemetryFreshness {
  if (!recordedAt) {
    return "missing";
  }

  const ageMs = Date.now() - recordedAt.getTime();
  return ageMs <= staleThresholdMs ? "live" : "stale";
}

export function toFleetVehicleView(
  vehicle: {
  _id: unknown;
  samsaraId?: string;
  openroadTruckId?: number;
  unitNumber: string;
  vin?: string;
  make?: string;
  model?: string;
  year?: string;
  licensePlate?: string;
  fuelTankCapacityGallons?: number;
  openroadStatus?: string;
  mappingStatus: FleetMappingStatus;
  isActive: boolean;
  gps?: FleetGpsTelemetry;
  fuel?: FleetFuelTelemetry;
  registrySyncedAt?: Date;
  telemetrySyncedAt?: Date;
  updatedAt: Date;
},
  staleThresholdMs: number,
): FleetVehicleView {
  const gpsFreshness = getFreshness(vehicle.gps?.recordedAt, staleThresholdMs);
  const fuelFreshness = getFreshness(vehicle.fuel?.recordedAt, staleThresholdMs);

  return {
    id: String(vehicle._id),
    samsaraId: vehicle.samsaraId,
    openroadTruckId: vehicle.openroadTruckId,
    unitNumber: vehicle.unitNumber,
    vin: vehicle.vin,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    licensePlate: vehicle.licensePlate,
    fuelTankCapacityGallons:
      vehicle.fuelTankCapacityGallons && vehicle.fuelTankCapacityGallons > 0
        ? vehicle.fuelTankCapacityGallons
        : undefined,
    openroadStatus: vehicle.openroadStatus,
    mappingStatus: vehicle.mappingStatus,
    isActive: vehicle.isActive,
    gps: vehicle.gps
      ? {
          ...vehicle.gps,
          freshness: gpsFreshness,
        }
      : undefined,
    fuel: vehicle.fuel
      ? {
          ...vehicle.fuel,
          freshness: fuelFreshness,
          isLow: vehicle.fuel.percent <= LOW_FUEL_PERCENT_THRESHOLD,
        }
      : undefined,
    registrySyncedAt: vehicle.registrySyncedAt?.toISOString(),
    telemetrySyncedAt: vehicle.telemetrySyncedAt?.toISOString(),
    updatedAt: vehicle.updatedAt.toISOString(),
  };
}

export function buildFleetSummary(vehicles: FleetVehicleView[], staleThresholdMs: number) {
  const activeVehicles = vehicles.filter((vehicle) => vehicle.isActive);

  return {
    totalVehicles: vehicles.length,
    activeVehicles: activeVehicles.length,
    liveGpsCount: activeVehicles.filter((vehicle) => vehicle.gps?.freshness === "live").length,
    liveFuelCount: activeVehicles.filter((vehicle) => vehicle.fuel?.freshness === "live").length,
    staleTelemetryCount: activeVehicles.filter(
      (vehicle) =>
        vehicle.gps?.freshness === "stale" ||
        vehicle.fuel?.freshness === "stale" ||
        vehicle.gps?.freshness === "missing" ||
        vehicle.fuel?.freshness === "missing",
    ).length,
    lowFuelCount: activeVehicles.filter((vehicle) => vehicle.fuel?.isLow).length,
    staleThresholdMinutes: staleThresholdMs / 60_000,
  };
}
