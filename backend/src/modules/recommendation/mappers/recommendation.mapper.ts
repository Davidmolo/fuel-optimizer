import type { RankedStationCandidate } from "../services/recommendation.engine";
import type { FuelRangeEstimate } from "../services/fuel-range";
import type { TripContextView } from "../../tms/mappers/trip-context.mapper";
import type { RecommendationFilterStats } from "../services/recommendation.engine";
import type { CorridorStationView, FuelPlanView } from "../services/fuel-plan.service";

export type RecommendedStopView = {
  rank: number;
  relayAccount: RankedStationCandidate["relayAccount"];
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

export type RecommendationCorridorView = {
  bufferMiles: number;
  pointCount: number;
  routeLengthMiles: number;
};

export type RecommendationView = {
  status: "ready" | "not_ready" | "no_candidates";
  message: string;
  tripContext: TripContextView;
  fuelRange?: FuelRangeEstimate;
  corridor?: RecommendationCorridorView;
  primary?: RecommendedStopView;
  alternates: RecommendedStopView[];
  corridorStations: CorridorStationView[];
  fuelPlan?: FuelPlanView;
  filterStats?: RecommendationFilterStats;
  routingProvider?: "google" | "osrm" | "trimble";
  isDemo?: boolean;
  searchMode?: "corridor" | "radial";
};

function toRecommendedStopView(candidate: RankedStationCandidate, rank: number): RecommendedStopView {
  return {
    rank,
    relayAccount: candidate.relayAccount,
    relayLocationId: candidate.relayLocationId,
    merchantName: candidate.merchantName,
    merchantDisplayName: candidate.pricing.merchantDisplayName,
    name: candidate.name,
    city: candidate.city,
    state: candidate.state,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    effectivePricePerGallon: candidate.effectivePricePerGallon,
    basePricePerGallon: candidate.pricing.basePricePerGallon,
    rateAdjustmentPerGallon: candidate.pricing.rateAdjustmentPerGallon,
    distanceMiles: candidate.distanceMiles,
    drivingDurationMinutes: candidate.drivingDurationMinutes,
    distanceAlongRouteMiles: candidate.distanceAlongRouteMiles,
    corridorDistanceMiles: candidate.corridorDistanceMiles,
  };
}

export function buildRecommendationView(options: {
  tripContext: TripContextView;
  status: RecommendationView["status"];
  message: string;
  fuelRange?: FuelRangeEstimate;
  corridor?: RecommendationCorridorView;
  primary?: RankedStationCandidate;
  alternates?: RankedStationCandidate[];
  corridorStations?: CorridorStationView[];
  fuelPlan?: FuelPlanView;
  filterStats?: RecommendationFilterStats;
  routingProvider?: RecommendationView["routingProvider"];
  isDemo?: boolean;
  searchMode?: RecommendationView["searchMode"];
}): RecommendationView {
  const alternates = (options.alternates ?? []).map((candidate, index) =>
    toRecommendedStopView(candidate, index + 2),
  );

  return {
    status: options.status,
    message: options.message,
    tripContext: options.tripContext,
    fuelRange: options.fuelRange,
    corridor: options.corridor,
    primary: options.primary ? toRecommendedStopView(options.primary, 1) : undefined,
    alternates,
    corridorStations: options.corridorStations ?? [],
    fuelPlan: options.fuelPlan,
    filterStats: options.filterStats,
    routingProvider: options.routingProvider,
    isDemo: options.isDemo,
    searchMode: options.searchMode,
  };
}
