import type { RelayAccount } from "@/types/station";
import type { TripContext } from "@/types/tms";

export type RecommendedStop = {
  rank: number;
  relayAccount: RelayAccount;
  relayLocationId: string;
  merchantName?: string;
  merchantDisplayName: string;
  name?: string;
  city?: string;
  state?: string;
  latitude: number;
  longitude: number;
  effectivePricePerGallon: number;
  basePricePerGallon: number;
  rateAdjustmentPerGallon: number;
  distanceMiles: number;
  drivingDurationMinutes: number;
  distanceAlongRouteMiles: number;
  corridorDistanceMiles: number;
};

export type CorridorStation = {
  relayAccount: RelayAccount;
  relayLocationId: string;
  merchantName?: string;
  merchantDisplayName: string;
  name?: string;
  city?: string;
  state?: string;
  latitude: number;
  longitude: number;
  effectivePricePerGallon: number;
  distanceAlongRouteMiles: number;
  withinCurrentFuelRange: boolean;
};

export type FuelPlanStop = {
  kind: "survival_fill" | "strategic_fill";
  relayLocationId: string;
  merchantDisplayName: string;
  name?: string;
  city?: string;
  state?: string;
  distanceMiles: number;
  distanceAlongRouteMiles: number;
  effectivePricePerGallon: number;
  suggestedGallons?: number;
  reason: string;
};

export type FuelPlan = {
  isLowFuel: boolean;
  canReachCheapestDirectly: boolean;
  cheapestOnRoute: FuelPlanStop;
  now?: FuelPlanStop;
  then?: FuelPlanStop;
};

export type FuelRangeEstimate = {
  fuelPercent: number;
  tankCapacityGallons: number;
  mpg: number;
  reserveFuelPercent: number;
  remainingGallons: number;
  reserveGallons: number;
  usableGallons: number;
  usableRangeMiles: number;
};

export type RecommendationCorridor = {
  bufferMiles: number;
  pointCount: number;
  routeLengthMiles: number;
};

export type Recommendation = {
  status: "ready" | "not_ready" | "no_candidates";
  message: string;
  tripContext: TripContext;
  fuelRange?: FuelRangeEstimate;
  corridor?: RecommendationCorridor;
  primary?: RecommendedStop;
  alternates: RecommendedStop[];
  corridorStations: CorridorStation[];
  fuelPlan?: FuelPlan;
  routingProvider?: "google" | "osrm" | "trimble";
  isDemo?: boolean;
  searchMode?: "corridor" | "radial";
};

export type RecommendationResponse = {
  success: boolean;
  message: string;
  data: Recommendation;
};
