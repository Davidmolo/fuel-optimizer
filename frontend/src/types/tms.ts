export type TmsLoadDestination = {
  position: number;
  stopType: string;
  companyName?: string;
  city?: string;
  stateCode?: string;
  lat?: number;
  lng?: number;
  appointmentDate?: string;
  completed: boolean;
};

export type TmsLoad = {
  id: string;
  openroadLoadId: number;
  status: string;
  customerLoad?: string;
  companyLoad?: string;
  equipment?: string;
  commodity?: string;
  customerName?: string;
  hot: boolean;
  originCity?: string;
  originStateCode?: string;
  destinationCity?: string;
  destinationStateCode?: string;
  routeLabel: string;
  primaryDriverId?: number;
  truckUnit?: string;
  openroadTruckId?: number;
  destinations: TmsLoadDestination[];
  syncedAt?: string;
  updatedAt: string;
};

export type TmsSummary = {
  totalActiveLoads: number;
  loadsWithTruck: number;
  loadsWithRoute: number;
  hotLoads: number;
};

export type TmsDriver = {
  openroadDriverId: number;
  employeeNr?: string;
  displayName?: string;
  phone?: string;
  team?: string;
  status?: string;
};

export type TripContextVehicle = {
  fleetVehicleId?: string;
  samsaraId?: string;
  unitNumber?: string;
  mappingStatus?: "linked" | "samsara_only" | "openroad_only" | "conflict";
  gps?: {
    latitude: number;
    longitude: number;
    formattedLocation?: string;
    freshness: "live" | "stale" | "missing";
    recordedAt: string;
  };
  fuel?: {
    percent: number;
    freshness: "live" | "stale" | "missing";
    isLow: boolean;
    recordedAt: string;
  };
};

export type TripContextLinkage = {
  hasDriver: boolean;
  hasTruckAssignment: boolean;
  hasFleetVehicle: boolean;
  hasTelemetry: boolean;
  isReadyForRecommendation: boolean;
};

export type TripContext = {
  load: TmsLoad;
  driver?: TmsDriver;
  vehicle?: TripContextVehicle;
  linkage: TripContextLinkage;
};

export type TripContextListResponse = {
  summary: TmsSummary & {
    readyForRecommendationCount: number;
    withTelemetryCount: number;
  };
  items: TripContext[];
};

export type TmsSyncResponse = {
  truckCount: number;
  trucksSyncedAt: string;
  linking: {
    linkedCount: number;
    openroadOnlyCount: number;
    samsaraOnlyCount: number;
    conflictCount: number;
  };
  driverCount: number;
  driversSyncedAt: string;
  assignmentCount: number;
  assignmentsSyncedAt: string;
  activeLoadCount: number;
  loadsWithTruck: number;
  loadsSyncedAt: string;
  telemetryStatus?: "succeeded" | "skipped" | "failed";
  telemetryError?: string;
  telemetrySkipReason?: string;
  telemetrySyncedAt?: string;
};

export type TripDrivingRoute = {
  routeLabel: string;
  waypointCount: number;
  polyline: Array<{ lat: number; lng: number }>;
  distanceMiles: number;
  durationMinutes: number;
  source: "osrm" | "trimble";
};
