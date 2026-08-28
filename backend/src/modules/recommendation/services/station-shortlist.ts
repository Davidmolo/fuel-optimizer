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
import type { RecommendationConfigValues } from "../constants";
import type { FuelRangeEstimate } from "./fuel-range";

export type StationShortlistInput = {
  truckPosition: GeoPoint;
  routePolyline: GeoPoint[];
  fuelRange: FuelRangeEstimate;
  config: RecommendationConfigValues;
  stations: FuelStationDocument[];
  pricingByLocationId: Map<string, ContractPricingResult>;
};

export type StationShortlistStats = {
  totalStations: number;
  withCoordinates: number;
  contractedAndPriced: number;
  inCorridor: number;
  aheadOnRoute: number;
  withinPreFilterDistance: number;
  shortlistedForRouting: number;
};

export type StationShortlistResult = {
  stations: FuelStationDocument[];
  stats: StationShortlistStats;
  searchAheadMiles: number;
  preFilterDistanceMiles: number;
};

function hasCoordinates(
  station: FuelStationDocument,
): station is FuelStationDocument & { latitude: number; longitude: number } {
  return station.latitude !== undefined && station.longitude !== undefined;
}

export function resolveSearchAheadMiles(config: RecommendationConfigValues, fuelRange: FuelRangeEstimate) {
  return Math.min(fuelRange.usableRangeMiles, config.maxSearchAheadMiles);
}

export function resolvePreFilterDistanceMiles(config: RecommendationConfigValues, fuelRange: FuelRangeEstimate) {
  const bufferMultiplier = 1 + config.preFilterDistanceBufferPercent / 100;
  return fuelRange.usableRangeMiles * bufferMultiplier;
}

export function shortlistStationsForRouting(input: StationShortlistInput): StationShortlistResult {
  const searchAheadMiles = resolveSearchAheadMiles(input.config, input.fuelRange);
  const preFilterDistanceMiles = resolvePreFilterDistanceMiles(input.config, input.fuelRange);

  const stats: StationShortlistStats = {
    totalStations: input.stations.length,
    withCoordinates: 0,
    contractedAndPriced: 0,
    inCorridor: 0,
    aheadOnRoute: 0,
    withinPreFilterDistance: 0,
    shortlistedForRouting: 0,
  };

  const geometricCandidates: Array<{
    station: FuelStationDocument & { latitude: number; longitude: number };
    corridorDistanceMiles: number;
  }> = [];

  for (const station of input.stations) {
    if (!hasCoordinates(station)) {
      continue;
    }

    stats.withCoordinates += 1;

    const pricing = input.pricingByLocationId.get(station.relayLocationId);

    if (!pricing?.available) {
      continue;
    }

    stats.contractedAndPriced += 1;

    const stationPoint: GeoPoint = {
      lat: station.latitude,
      lng: station.longitude,
    };

    if (!isPointInCorridor(stationPoint, input.routePolyline, input.config.corridorBufferMiles)) {
      continue;
    }

    stats.inCorridor += 1;

    if (
      !isPointAheadOnPolyline(
        stationPoint,
        input.truckPosition,
        input.routePolyline,
        input.config.minAheadOnRouteMiles,
      )
    ) {
      continue;
    }

    stats.aheadOnRoute += 1;

    const straightLineDistanceMiles = haversineDistanceMiles(input.truckPosition, stationPoint);

    if (straightLineDistanceMiles > preFilterDistanceMiles) {
      continue;
    }

    stats.withinPreFilterDistance += 1;

    geometricCandidates.push({
      station,
      corridorDistanceMiles: minDistanceToPolylineMiles(stationPoint, input.routePolyline),
    });
  }

  geometricCandidates.sort((left, right) => {
    if (left.corridorDistanceMiles !== right.corridorDistanceMiles) {
      return left.corridorDistanceMiles - right.corridorDistanceMiles;
    }

    const leftAlongRoute = distanceAlongPolylineMiles(
      { lat: left.station.latitude, lng: left.station.longitude },
      input.routePolyline,
    );
    const rightAlongRoute = distanceAlongPolylineMiles(
      { lat: right.station.latitude, lng: right.station.longitude },
      input.routePolyline,
    );

    return leftAlongRoute - rightAlongRoute;
  });

  const shortlisted = geometricCandidates
    .slice(0, input.config.maxRoutingLookups)
    .map((entry) => entry.station);

  stats.shortlistedForRouting = shortlisted.length;

  return {
    stations: shortlisted,
    stats,
    searchAheadMiles,
    preFilterDistanceMiles,
  };
}
