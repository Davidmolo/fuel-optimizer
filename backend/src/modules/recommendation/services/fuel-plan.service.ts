import {
  distanceAlongPolylineMiles,
  haversineDistanceMiles,
  isPointAheadOnPolyline,
  isPointInCorridor,
  type GeoPoint,
} from "../../../utils/geo";
import type { ContractPricingResult } from "../../contract/services/contract-pricing.engine";
import type { FuelStationDocument } from "../../station/models/fuel-station.model";
import type { RecommendationConfigValues } from "../constants";
import type { RankedStationCandidate } from "./recommendation.engine";

export type CorridorStationView = {
  relayAccount: FuelStationDocument["relayAccount"];
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

export type FuelPlanStopView = {
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

export type FuelPlanView = {
  isLowFuel: boolean;
  canReachCheapestDirectly: boolean;
  cheapestOnRoute: FuelPlanStopView;
  now?: FuelPlanStopView;
  then?: FuelPlanStopView;
};

function hasCoordinates(
  station: FuelStationDocument,
): station is FuelStationDocument & { latitude: number; longitude: number } {
  return station.latitude !== undefined && station.longitude !== undefined;
}

/** Same Relay location can exist under multiple accounts; keep one row per location. */
function dedupeCorridorStationsByLocationId(stations: CorridorStationView[]): CorridorStationView[] {
  const seen = new Set<string>();
  const unique: CorridorStationView[] = [];

  for (const station of stations) {
    if (seen.has(station.relayLocationId)) {
      continue;
    }

    seen.add(station.relayLocationId);
    unique.push(station);
  }

  return unique;
}

export function listCorridorStationCandidates(input: {
  truckPosition: GeoPoint;
  routePolyline: GeoPoint[];
  config: RecommendationConfigValues;
  stations: FuelStationDocument[];
  pricingByLocationId: Map<string, ContractPricingResult>;
  usableRangeMiles: number;
}): CorridorStationView[] {
  const truckAlongRouteMiles = distanceAlongPolylineMiles(input.truckPosition, input.routePolyline);
  const results: CorridorStationView[] = [];

  for (const station of input.stations) {
    if (!hasCoordinates(station)) {
      continue;
    }

    const pricing = input.pricingByLocationId.get(station.relayLocationId);

    if (!pricing?.available) {
      continue;
    }

    const stationPoint: GeoPoint = {
      lat: station.latitude,
      lng: station.longitude,
    };

    if (!isPointInCorridor(stationPoint, input.routePolyline, input.config.corridorBufferMiles)) {
      continue;
    }

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

    const stationAlongRouteMiles = distanceAlongPolylineMiles(stationPoint, input.routePolyline);
    const distanceAlongRouteMiles = stationAlongRouteMiles - truckAlongRouteMiles;

    if (distanceAlongRouteMiles <= 0) {
      continue;
    }

    results.push({
      relayAccount: station.relayAccount,
      relayLocationId: station.relayLocationId,
      merchantName: station.merchantName,
      merchantDisplayName: pricing.merchantDisplayName,
      name: station.name,
      city: station.city,
      state: station.state,
      latitude: station.latitude,
      longitude: station.longitude,
      effectivePricePerGallon: pricing.effectivePricePerGallon,
      distanceAlongRouteMiles: Math.round(distanceAlongRouteMiles * 10) / 10,
      withinCurrentFuelRange: distanceAlongRouteMiles <= input.usableRangeMiles,
    });
  }

  results.sort((left, right) => {
    if (left.effectivePricePerGallon !== right.effectivePricePerGallon) {
      return left.effectivePricePerGallon - right.effectivePricePerGallon;
    }

    return left.distanceAlongRouteMiles - right.distanceAlongRouteMiles;
  });

  return dedupeCorridorStationsByLocationId(results);
}

export function listRadialStationCandidates(input: {
  truckPosition: GeoPoint;
  usableRangeMiles: number;
  config: RecommendationConfigValues;
  stations: FuelStationDocument[];
  pricingByLocationId: Map<string, ContractPricingResult>;
}): CorridorStationView[] {
  const searchMiles = Math.min(input.usableRangeMiles, input.config.maxSearchAheadMiles);
  const results: CorridorStationView[] = [];

  for (const station of input.stations) {
    if (!hasCoordinates(station)) {
      continue;
    }

    const pricing = input.pricingByLocationId.get(station.relayLocationId);

    if (!pricing?.available) {
      continue;
    }

    const stationPoint: GeoPoint = {
      lat: station.latitude,
      lng: station.longitude,
    };
    const distanceMiles = haversineDistanceMiles(input.truckPosition, stationPoint);

    if (distanceMiles > searchMiles) {
      continue;
    }

    results.push({
      relayAccount: station.relayAccount,
      relayLocationId: station.relayLocationId,
      merchantName: station.merchantName,
      merchantDisplayName: pricing.merchantDisplayName,
      name: station.name,
      city: station.city,
      state: station.state,
      latitude: station.latitude,
      longitude: station.longitude,
      effectivePricePerGallon: pricing.effectivePricePerGallon,
      distanceAlongRouteMiles: Math.round(distanceMiles * 10) / 10,
      withinCurrentFuelRange: distanceMiles <= input.usableRangeMiles,
    });
  }

  results.sort((left, right) => {
    if (left.effectivePricePerGallon !== right.effectivePricePerGallon) {
      return left.effectivePricePerGallon - right.effectivePricePerGallon;
    }

    return left.distanceAlongRouteMiles - right.distanceAlongRouteMiles;
  });

  return dedupeCorridorStationsByLocationId(results);
}

function toPlanStopFromRanked(
  candidate: RankedStationCandidate,
  kind: FuelPlanStopView["kind"],
  options: { suggestedGallons?: number; reason: string },
): FuelPlanStopView {
  return {
    kind,
    relayLocationId: candidate.relayLocationId,
    merchantDisplayName: candidate.pricing.merchantDisplayName,
    name: candidate.name,
    city: candidate.city,
    state: candidate.state,
    distanceMiles: candidate.distanceMiles,
    distanceAlongRouteMiles: candidate.distanceAlongRouteMiles,
    effectivePricePerGallon: candidate.effectivePricePerGallon,
    suggestedGallons: options.suggestedGallons,
    reason: options.reason,
  };
}

export function buildFuelPlan(input: {
  fuelPercent: number;
  fuelRange: {
    mpg: number;
    usableGallons: number;
    usableRangeMiles: number;
    tankCapacityGallons: number;
  };
  config: RecommendationConfigValues;
  cheapestOnRoute: CorridorStationView;
  primaryWithinRange?: RankedStationCandidate;
}): FuelPlanView {
  const isLowFuel = input.fuelPercent < input.config.sweetSpotMinPercent;
  const canReachCheapestDirectly = input.cheapestOnRoute.distanceAlongRouteMiles <= input.fuelRange.usableRangeMiles;

  const cheapestStop: FuelPlanStopView = {
    kind: "strategic_fill",
    relayLocationId: input.cheapestOnRoute.relayLocationId,
    merchantDisplayName: input.cheapestOnRoute.merchantDisplayName,
    name: input.cheapestOnRoute.name,
    city: input.cheapestOnRoute.city,
    state: input.cheapestOnRoute.state,
    distanceMiles: input.cheapestOnRoute.distanceAlongRouteMiles,
    distanceAlongRouteMiles: input.cheapestOnRoute.distanceAlongRouteMiles,
    effectivePricePerGallon: input.cheapestOnRoute.effectivePricePerGallon,
    reason: `Cheapest contracted stop on your route at $${input.cheapestOnRoute.effectivePricePerGallon.toFixed(3)}/gal.`,
  };

  if (canReachCheapestDirectly) {
    return {
      isLowFuel,
      canReachCheapestDirectly: true,
      cheapestOnRoute: cheapestStop,
      now: {
        ...cheapestStop,
        suggestedGallons: isLowFuel
          ? Math.min(
              input.fuelRange.tankCapacityGallons,
              Math.max(
                20,
                Math.round(
                  ((input.config.sweetSpotMaxPercent / 100) * input.fuelRange.tankCapacityGallons -
                    (input.fuelRange.tankCapacityGallons * input.fuelPercent) / 100) *
                    10,
                ) / 10,
              ),
            )
          : undefined,
        reason: isLowFuel
          ? "Fuel is low. Fill enough here to reach the cheapest stop comfortably, or fill fully if this is the cheapest option."
          : cheapestStop.reason,
      },
    };
  }

  if (!input.primaryWithinRange) {
    return {
      isLowFuel: true,
      canReachCheapestDirectly: false,
      cheapestOnRoute: cheapestStop,
    };
  }

  const milesShort = input.cheapestOnRoute.distanceAlongRouteMiles - input.fuelRange.usableRangeMiles;
  const gallonsNeeded = Math.min(
    input.fuelRange.tankCapacityGallons,
    Math.max(15, Math.ceil((milesShort / input.fuelRange.mpg) * 10) / 10 + 10),
  );

  return {
    isLowFuel: true,
    canReachCheapestDirectly: false,
    cheapestOnRoute: cheapestStop,
    now: toPlanStopFromRanked(input.primaryWithinRange, "survival_fill", {
      suggestedGallons: gallonsNeeded,
      reason: `Fuel is low. Add about ${gallonsNeeded} gal here so you can reach the cheapest stop ${input.cheapestOnRoute.distanceAlongRouteMiles.toFixed(0)} mi ahead.`,
    }),
    then: {
      ...cheapestStop,
      suggestedGallons: Math.round((input.fuelRange.tankCapacityGallons - input.fuelRange.usableGallons) * 10) / 10,
      reason: "Fill the tank at the cheapest contracted stop on your route.",
    },
  };
}
