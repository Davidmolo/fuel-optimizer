import {
  distanceAlongPolylineMiles,
  haversineDistanceMiles,
  isPointAheadOnPolyline,
  isPointInCorridor,
  minDistanceToPolylineMiles,
  type GeoPoint,
} from "../../../utils/geo";
import type { ContractPricingResult } from "../../contract/services/contract-pricing.engine";
import type { FuelStationDocument } from "../../station/models/fuel-station.model";
import {
  MIN_AHEAD_ON_ROUTE_MILES,
  DEFAULT_CORRIDOR_BUFFER_MILES,
  DEFAULT_MAX_ALTERNATES,
} from "../constants";
import type { FuelRangeEstimate } from "./fuel-range";

export type StationCandidateInput = Pick<
  FuelStationDocument,
  | "relayAccount"
  | "relayLocationId"
  | "merchantName"
  | "name"
  | "city"
  | "state"
  | "latitude"
  | "longitude"
  | "retailPricePerUnit"
  | "discountedPricePerUnit"
>;

export type StationDrivingDistance = {
  distanceMiles: number;
  durationMinutes: number;
};

export type RankedStationCandidate = {
  relayAccount: StationCandidateInput["relayAccount"];
  relayLocationId: string;
  merchantName?: string;
  name?: string;
  city?: string;
  state?: string;
  latitude: number;
  longitude: number;
  effectivePricePerGallon: number;
  distanceMiles: number;
  drivingDurationMinutes: number;
  distanceAlongRouteMiles: number;
  corridorDistanceMiles: number;
  pricing: Extract<ContractPricingResult, { available: true }>;
};

export type RecommendationFilterStats = {
  totalStations: number;
  withCoordinates: number;
  inCorridor: number;
  aheadOnRoute: number;
  withinRange: number;
  contractedAndPriced: number;
  candidates: number;
  withinPreFilterDistance?: number;
  shortlistedForRouting?: number;
};

export type RecommendationEngineResult = {
  primary?: RankedStationCandidate;
  alternates: RankedStationCandidate[];
  filterStats: RecommendationFilterStats;
};

export type RecommendationEngineInput = {
  truckPosition: GeoPoint;
  routePolyline: GeoPoint[];
  fuelRange: FuelRangeEstimate;
  stations: Array<{
    station: StationCandidateInput;
    pricing: ContractPricingResult;
  }>;
  drivingDistances?: Map<string, StationDrivingDistance>;
  options?: {
    corridorBufferMiles?: number;
    maxAlternates?: number;
    aheadToleranceMiles?: number;
    useEstimatedDistances?: boolean;
    searchMode?: "corridor" | "radial";
  };
};

function hasCoordinates(station: StationCandidateInput): station is StationCandidateInput & {
  latitude: number;
  longitude: number;
} {
  return station.latitude !== undefined && station.longitude !== undefined;
}

function compareCandidates(left: RankedStationCandidate, right: RankedStationCandidate) {
  if (left.effectivePricePerGallon !== right.effectivePricePerGallon) {
    return left.effectivePricePerGallon - right.effectivePricePerGallon;
  }

  if (left.distanceMiles !== right.distanceMiles) {
    return left.distanceMiles - right.distanceMiles;
  }

  if (left.distanceAlongRouteMiles !== right.distanceAlongRouteMiles) {
    return left.distanceAlongRouteMiles - right.distanceAlongRouteMiles;
  }

  return left.relayLocationId.localeCompare(right.relayLocationId);
}

export function rankFuelStops(input: RecommendationEngineInput): RecommendationEngineResult {
  const corridorBufferMiles = input.options?.corridorBufferMiles ?? DEFAULT_CORRIDOR_BUFFER_MILES;
  const maxAlternates = input.options?.maxAlternates ?? DEFAULT_MAX_ALTERNATES;
  const aheadToleranceMiles = input.options?.aheadToleranceMiles ?? MIN_AHEAD_ON_ROUTE_MILES;
  const searchMode = input.options?.searchMode ?? "corridor";

  const filterStats: RecommendationFilterStats = {
    totalStations: input.stations.length,
    withCoordinates: 0,
    inCorridor: 0,
    aheadOnRoute: 0,
    withinRange: 0,
    contractedAndPriced: 0,
    candidates: 0,
  };

  if (input.routePolyline.length < 2) {
    return {
      alternates: [],
      filterStats,
    };
  }

  const rankedCandidates: RankedStationCandidate[] = [];

  for (const entry of input.stations) {
    if (!hasCoordinates(entry.station)) {
      continue;
    }

    filterStats.withCoordinates += 1;

    const stationPoint: GeoPoint = {
      lat: entry.station.latitude,
      lng: entry.station.longitude,
    };

    let distanceAlongRouteMiles: number;
    let distanceMiles: number;
    let drivingDurationMinutes = 0;

    if (searchMode === "radial") {
      distanceMiles = haversineDistanceMiles(input.truckPosition, stationPoint);
      distanceAlongRouteMiles = distanceMiles;

      if (distanceMiles > input.fuelRange.usableRangeMiles) {
        continue;
      }

      filterStats.inCorridor += 1;
      filterStats.aheadOnRoute += 1;
    } else {
      if (!isPointInCorridor(stationPoint, input.routePolyline, corridorBufferMiles)) {
        continue;
      }

      filterStats.inCorridor += 1;

      if (!isPointAheadOnPolyline(stationPoint, input.truckPosition, input.routePolyline, aheadToleranceMiles)) {
        continue;
      }

      filterStats.aheadOnRoute += 1;

      const truckAlongRouteMiles = distanceAlongPolylineMiles(input.truckPosition, input.routePolyline);
      const stationAlongRouteMiles = distanceAlongPolylineMiles(stationPoint, input.routePolyline);
      distanceAlongRouteMiles = stationAlongRouteMiles - truckAlongRouteMiles;
      const corridorDistanceMiles = minDistanceToPolylineMiles(stationPoint, input.routePolyline);

      if (distanceAlongRouteMiles <= 0) {
        continue;
      }

      const useEstimatedDistances = input.options?.useEstimatedDistances ?? false;

      if (useEstimatedDistances) {
        const effectiveRangeMiles = distanceAlongRouteMiles + corridorDistanceMiles;

        if (effectiveRangeMiles > input.fuelRange.usableRangeMiles) {
          continue;
        }

        distanceMiles = haversineDistanceMiles(input.truckPosition, stationPoint);
      } else {
        const drivingDistance = input.drivingDistances?.get(entry.station.relayLocationId);

        if (!drivingDistance) {
          continue;
        }

        if (drivingDistance.distanceMiles > input.fuelRange.usableRangeMiles) {
          continue;
        }

        distanceMiles = drivingDistance.distanceMiles;
        drivingDurationMinutes = drivingDistance.durationMinutes;
      }
    }

    filterStats.withinRange += 1;

    if (!entry.pricing.available) {
      continue;
    }

    filterStats.contractedAndPriced += 1;

    const corridorDistanceMiles =
      searchMode === "radial"
        ? distanceAlongRouteMiles
        : minDistanceToPolylineMiles(stationPoint, input.routePolyline);

    rankedCandidates.push({
      relayAccount: entry.station.relayAccount,
      relayLocationId: entry.station.relayLocationId,
      merchantName: entry.station.merchantName,
      name: entry.station.name,
      city: entry.station.city,
      state: entry.station.state,
      latitude: entry.station.latitude,
      longitude: entry.station.longitude,
      effectivePricePerGallon: entry.pricing.effectivePricePerGallon,
      distanceMiles: Math.round(distanceMiles * 10) / 10,
      drivingDurationMinutes,
      distanceAlongRouteMiles: Math.round(distanceAlongRouteMiles * 10) / 10,
      corridorDistanceMiles: Math.round(corridorDistanceMiles * 10) / 10,
      pricing: entry.pricing,
    });
  }

  rankedCandidates.sort(compareCandidates);
  filterStats.candidates = rankedCandidates.length;

  const [primary, ...remaining] = rankedCandidates;

  return {
    primary,
    alternates: remaining.slice(0, maxAlternates),
    filterStats,
  };
}
