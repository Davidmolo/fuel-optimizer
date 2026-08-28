export type TelemetryFreshness = "live" | "stale" | "missing";

export type FleetGpsTelemetry = {
  latitude: number;
  longitude: number;
  headingDegrees?: number;
  speedMilesPerHour?: number;
  formattedLocation?: string;
  addressName?: string;
  recordedAt: string;
  freshness: TelemetryFreshness;
};

export type FleetFuelTelemetry = {
  percent: number;
  recordedAt: string;
  freshness: TelemetryFreshness;
  isLow: boolean;
};

export type FleetVehicle = {
  id: string;
  samsaraId?: string;
  openroadTruckId?: number;
  unitNumber: string;
  vin?: string;
  make?: string;
  model?: string;
  year?: string;
  licensePlate?: string;
  openroadStatus?: string;
  mappingStatus?: "linked" | "samsara_only" | "openroad_only" | "conflict";
  isActive: boolean;
  gps?: FleetGpsTelemetry;
  fuel?: FleetFuelTelemetry;
  registrySyncedAt?: string;
  telemetrySyncedAt?: string;
  updatedAt: string;
};

export type FleetSummary = {
  totalVehicles: number;
  activeVehicles: number;
  liveGpsCount: number;
  liveFuelCount: number;
  staleTelemetryCount: number;
  lowFuelCount: number;
  staleThresholdMinutes: number;
};

export type FleetListResponse = {
  summary: FleetSummary;
  items: FleetVehicle[];
};

export type FleetSyncResponse = {
  registryCount: number;
  registrySyncedAt: string;
  telemetryCount: number;
  missingRegistryCount: number;
  telemetrySyncedAt: string;
};
