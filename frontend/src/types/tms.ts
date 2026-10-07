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

export type TrimbleTripFuelStop = {
  relayAccount: string;
  relayLocationId: string;
  merchantName?: string;
  name?: string;
  city?: string;
  state?: string;
  latitude: number;
  longitude: number;
  effectivePricePerGallon?: number;
  stopIndex: number;
  insertedAt: string;
  reason?: string;
};

export type TrimbleTripSummary = {
  alkTripId: string;
  tmsTripId: string;
  tripStatus?: string;
  tspDriverId?: string | null;
  fuelStop?: TrimbleTripFuelStop | null;
  fuelStops?: TrimbleTripFuelStop[];
  lastRecommendationStatus?: "ready" | "not_ready" | "no_candidates";
  lastRecommendationMessage?: string;
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
  trimbleTrip?: TrimbleTripSummary;
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
  trimbleAssetId?: string;
  tripManagementEnabled?: boolean;
  copilotStatus?: string;
  dispatcherName?: string;
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

export type CopilotSendInfo = {
  canSend: boolean;
  blockedReason?: string;
  driverAcceptStatus:
    | "not_sent"
    | "waiting"
    | "accepted"
    | "declined"
    | "completed"
    | "canceled"
    | "unknown";
  tripStatus?: string;
  tspDriverId?: string | null;
  fuelStopOnTrip: boolean;
};

export type TripContext = {
  load: TmsLoad;
  driver?: TmsDriver;
  vehicle?: TripContextVehicle;
  linkage: TripContextLinkage;
  copilot?: CopilotSendInfo;
};

export type TripContextListResponse = {
  summary: TmsSummary & {
    readyForRecommendationCount: number;
    withTelemetryCount: number;
  };
  items: TripContext[];
  fleetScope?: {
    mode: "all" | "dispatcher" | "none";
    dispatcherName?: string;
    reason?: string;
  };
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
};
