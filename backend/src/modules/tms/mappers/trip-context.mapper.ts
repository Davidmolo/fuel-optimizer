import type { FleetFuelTelemetry, FleetGpsTelemetry, FleetMappingStatus } from "../../fleet/models/fleet-vehicle.model";
import type { TelemetryFreshness } from "../../fleet/mappers/fleet-vehicle.mapper";
import type { TmsLoadDocument, TrimbleTripFuelStopRecord } from "../models/tms-load.model";

export type TmsLoadDestinationView = {
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

export type TrimbleTripFuelStopView = {
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

export type TrimbleTripSummaryView = {
  alkTripId: string;
  tmsTripId: string;
  tripStatus?: string;
  tspDriverId?: string | null;
  fuelStop?: TrimbleTripFuelStopView | null;
  lastRecommendationStatus?: "ready" | "not_ready" | "no_candidates";
  lastRecommendationMessage?: string;
};

export type TmsLoadView = {
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
  destinations: TmsLoadDestinationView[];
  trimbleTrip?: TrimbleTripSummaryView;
  syncedAt?: string;
  updatedAt: string;
};

export type TmsDriverView = {
  openroadDriverId: number;
  employeeNr?: string;
  displayName?: string;
  phone?: string;
  team?: string;
  status?: string;
};

export type TripContextVehicleView = {
  fleetVehicleId?: string;
  samsaraId?: string;
  unitNumber?: string;
  mappingStatus?: FleetMappingStatus;
  fuelTankCapacityGallons?: number;
  gps?: FleetGpsTelemetry & { freshness: TelemetryFreshness };
  fuel?: FleetFuelTelemetry & { freshness: TelemetryFreshness; isLow: boolean };
};

export type TripContextView = {
  load: TmsLoadView;
  driver?: TmsDriverView;
  vehicle?: TripContextVehicleView;
  linkage: {
    hasDriver: boolean;
    hasTruckAssignment: boolean;
    hasFleetVehicle: boolean;
    hasTelemetry: boolean;
    isReadyForRecommendation: boolean;
  };
};

function toFuelStopView(fuelStop: TrimbleTripFuelStopRecord): TrimbleTripFuelStopView {
  return {
    relayAccount: fuelStop.relayAccount,
    relayLocationId: fuelStop.relayLocationId,
    merchantName: fuelStop.merchantName,
    name: fuelStop.name,
    city: fuelStop.city,
    state: fuelStop.state,
    latitude: fuelStop.latitude,
    longitude: fuelStop.longitude,
    effectivePricePerGallon: fuelStop.effectivePricePerGallon,
    stopIndex: fuelStop.stopIndex,
    insertedAt:
      fuelStop.insertedAt instanceof Date ? fuelStop.insertedAt.toISOString() : String(fuelStop.insertedAt),
    reason: fuelStop.reason,
  };
}

export function buildRouteLabel(
  load: Pick<TmsLoadDocument, "originCity" | "originStateCode" | "destinationCity" | "destinationStateCode">,
) {
  const origin = [load.originCity, load.originStateCode].filter(Boolean).join(", ");
  const destination = [load.destinationCity, load.destinationStateCode].filter(Boolean).join(", ");

  if (origin && destination) {
    return `${origin} → ${destination}`;
  }

  return origin || destination || "Route pending";
}

export function toTmsLoadView(load: TmsLoadDocument): TmsLoadView {
  const trimble = load.trimbleTrip;

  return {
    id: String(load._id),
    openroadLoadId: load.openroadLoadId,
    status: load.status,
    customerLoad: load.customerLoad,
    companyLoad: load.companyLoad,
    equipment: load.equipment,
    commodity: load.commodity,
    customerName: load.customerName,
    hot: load.hot,
    originCity: load.originCity,
    originStateCode: load.originStateCode,
    destinationCity: load.destinationCity,
    destinationStateCode: load.destinationStateCode,
    routeLabel: buildRouteLabel(load),
    primaryDriverId: load.primaryDriverId,
    truckUnit: load.truckUnit,
    openroadTruckId: load.openroadTruckId,
    destinations: load.destinations.map((destination) => ({
      position: destination.position,
      stopType: destination.stopType,
      companyName: destination.companyName,
      city: destination.city,
      stateCode: destination.stateCode,
      lat: destination.lat,
      lng: destination.lng,
      appointmentDate: destination.appointmentDate,
      completed: destination.completed,
    })),
    trimbleTrip: trimble
      ? {
          alkTripId: trimble.alkTripId,
          tmsTripId: trimble.tmsTripId,
          tripStatus: trimble.tripStatus,
          tspDriverId: trimble.tspDriverId ?? null,
          fuelStop: trimble.fuelStop ? toFuelStopView(trimble.fuelStop) : null,
          lastRecommendationStatus: trimble.lastRecommendationStatus,
          lastRecommendationMessage: trimble.lastRecommendationMessage,
        }
      : undefined,
    syncedAt: load.syncedAt?.toISOString(),
    updatedAt: load.updatedAt.toISOString(),
  };
}

export function buildTmsSummary(loads: TmsLoadView[]) {
  return {
    totalActiveLoads: loads.length,
    loadsWithTruck: loads.filter((load) => Boolean(load.truckUnit)).length,
    loadsWithRoute: loads.filter((load) => Boolean(load.originCity && load.destinationCity)).length,
    hotLoads: loads.filter((load) => load.hot).length,
  };
}
