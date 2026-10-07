import type { RecommendationConfigValues } from "../constants";
import type { CorridorStationView, FuelPlanStopView, FuelPlanView } from "./fuel-plan.service";
import { calculateFuelRangeEstimate } from "./fuel-range";

/** Hard cap so a bad corridor never floods Trimble with FuelStops. */
export const DEFAULT_MAX_FUEL_STOPS = 8;

/** Prefer stations in the last portion of reachable range (maximize progress, still buy cheap). */
export const LATE_RANGE_FRACTION = 0.35;

export type FuelStopChainCandidate = {
  relayAccount: CorridorStationView["relayAccount"];
  relayLocationId: string;
  merchantName?: string;
  merchantDisplayName: string;
  name?: string;
  city?: string;
  state?: string;
  latitude: number;
  longitude: number;
  effectivePricePerGallon: number;
  /** Absolute miles along the route polyline from the origin. */
  absoluteAlongRouteMiles: number;
};

export type FuelStopChainResult = {
  stops: FuelPlanStopView[];
  canReachDestination: boolean;
  blockedReason?: string;
  cheapestOnRoute?: FuelPlanStopView;
};

export function corridorStationsToChainCandidates(
  stations: CorridorStationView[],
  truckAlongRouteMiles: number,
): FuelStopChainCandidate[] {
  return stations.map((station) => ({
    relayAccount: station.relayAccount,
    relayLocationId: station.relayLocationId,
    merchantName: station.merchantName,
    merchantDisplayName: station.merchantDisplayName,
    name: station.name,
    city: station.city,
    state: station.state,
    latitude: station.latitude,
    longitude: station.longitude,
    effectivePricePerGallon: station.effectivePricePerGallon,
    absoluteAlongRouteMiles: truckAlongRouteMiles + station.distanceAlongRouteMiles,
  }));
}

function roundGallons(value: number) {
  return Math.round(value * 10) / 10;
}

function roundMiles(value: number) {
  return Math.round(value * 10) / 10;
}

function gallonsToSweetSpot(
  currentFuelPercent: number,
  tankCapacityGallons: number,
  sweetSpotMaxPercent: number,
) {
  const targetGallons = (sweetSpotMaxPercent / 100) * tankCapacityGallons;
  const currentGallons = (tankCapacityGallons * currentFuelPercent) / 100;
  return roundGallons(Math.max(0, Math.min(tankCapacityGallons, targetGallons - currentGallons)));
}

function toPlanStop(
  candidate: FuelStopChainCandidate,
  kind: FuelPlanStopView["kind"],
  options: {
    distanceMiles: number;
    suggestedGallons?: number;
    reason: string;
  },
): FuelPlanStopView {
  return {
    kind,
    relayAccount: candidate.relayAccount,
    relayLocationId: candidate.relayLocationId,
    merchantName: candidate.merchantName,
    merchantDisplayName: candidate.merchantDisplayName,
    name: candidate.name,
    city: candidate.city,
    state: candidate.state,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    distanceMiles: roundMiles(options.distanceMiles),
    distanceAlongRouteMiles: roundMiles(options.distanceMiles),
    absoluteAlongRouteMiles: roundMiles(candidate.absoluteAlongRouteMiles),
    effectivePricePerGallon: candidate.effectivePricePerGallon,
    suggestedGallons: options.suggestedGallons,
    reason: options.reason,
  };
}

function pickBestReachable(
  candidates: FuelStopChainCandidate[],
  currentAlong: number,
  usableRangeMiles: number,
  minAheadMiles: number,
  destinationAlong: number,
): FuelStopChainCandidate | undefined {
  const maxReach = currentAlong + usableRangeMiles;
  const reachable = candidates.filter(
    (candidate) =>
      candidate.absoluteAlongRouteMiles >= currentAlong + minAheadMiles &&
      candidate.absoluteAlongRouteMiles <= maxReach &&
      candidate.absoluteAlongRouteMiles < destinationAlong,
  );

  if (reachable.length === 0) {
    return undefined;
  }

  const lateStart = currentAlong + usableRangeMiles * (1 - LATE_RANGE_FRACTION);
  const lateWindow = reachable.filter((candidate) => candidate.absoluteAlongRouteMiles >= lateStart);
  const pool = lateWindow.length > 0 ? lateWindow : reachable;

  return [...pool].sort((left, right) => {
    if (left.effectivePricePerGallon !== right.effectivePricePerGallon) {
      return left.effectivePricePerGallon - right.effectivePricePerGallon;
    }
    // Prefer farther when price ties — more progress per fill.
    return right.absoluteAlongRouteMiles - left.absoluteAlongRouteMiles;
  })[0];
}

/**
 * Greedy range-based fuel stop chain along a route corridor.
 * Plans as many contracted FuelStops as tank/MPG require to reach the destination.
 */
export function buildFuelStopChain(input: {
  currentAlongRouteMiles: number;
  destinationAlongRouteMiles: number;
  fuelPercent: number;
  fuelRange: {
    mpg: number;
    usableGallons: number;
    usableRangeMiles: number;
    tankCapacityGallons: number;
  };
  config: RecommendationConfigValues;
  candidates: FuelStopChainCandidate[];
  maxFuelStops?: number;
}): FuelStopChainResult {
  const maxFuelStops = input.maxFuelStops ?? DEFAULT_MAX_FUEL_STOPS;
  const minAhead = input.config.minAheadOnRouteMiles;
  const destinationAlong = Math.max(input.currentAlongRouteMiles, input.destinationAlongRouteMiles);

  const cheapestCandidate = [...input.candidates]
    .filter((candidate) => candidate.absoluteAlongRouteMiles > input.currentAlongRouteMiles)
    .sort((left, right) => {
      if (left.effectivePricePerGallon !== right.effectivePricePerGallon) {
        return left.effectivePricePerGallon - right.effectivePricePerGallon;
      }
      return left.absoluteAlongRouteMiles - right.absoluteAlongRouteMiles;
    })[0];

  const cheapestOnRoute = cheapestCandidate
    ? toPlanStop(cheapestCandidate, "strategic_fill", {
        distanceMiles: cheapestCandidate.absoluteAlongRouteMiles - input.currentAlongRouteMiles,
        reason: `Cheapest contracted stop on your route at $${cheapestCandidate.effectivePricePerGallon.toFixed(3)}/gal.`,
      })
    : undefined;

  const stops: FuelPlanStopView[] = [];
  let currentAlong = input.currentAlongRouteMiles;
  let fuelPercent = input.fuelPercent;
  let usableRangeMiles = input.fuelRange.usableRangeMiles;
  const usedLocationIds = new Set<string>();

  while (stops.length < maxFuelStops) {
    const remainingMiles = destinationAlong - currentAlong;
    if (remainingMiles <= usableRangeMiles) {
      return {
        stops,
        canReachDestination: true,
        cheapestOnRoute,
      };
    }

    const remainingCandidates = input.candidates.filter(
      (candidate) => !usedLocationIds.has(candidate.relayLocationId),
    );
    const chosen = pickBestReachable(
      remainingCandidates,
      currentAlong,
      usableRangeMiles,
      minAhead,
      destinationAlong,
    );

    if (!chosen) {
      return {
        stops,
        canReachDestination: false,
        blockedReason: `No contracted fuel stop within the remaining ${roundMiles(usableRangeMiles)} mi usable range (${roundMiles(remainingMiles)} mi still to destination).`,
        cheapestOnRoute,
      };
    }

    const distanceMiles = chosen.absoluteAlongRouteMiles - currentAlong;
    const isFirstRequired = stops.length === 0;
    const kind: FuelPlanStopView["kind"] = isFirstRequired ? "survival_fill" : "strategic_fill";

    // Burn fuel driving to this station, then suggest gallons to reach sweet-spot on arrival.
    const tank = input.fuelRange.tankCapacityGallons;
    const currentGallons = (tank * fuelPercent) / 100;
    const arrivalGallons = Math.max(0, currentGallons - distanceMiles / input.fuelRange.mpg);
    const arrivalPercent = tank > 0 ? (arrivalGallons / tank) * 100 : 0;
    const suggestedGallons = gallonsToSweetSpot(
      arrivalPercent,
      tank,
      input.config.sweetSpotMaxPercent,
    );

    stops.push(
      toPlanStop(chosen, kind, {
        distanceMiles,
        suggestedGallons: suggestedGallons > 0 ? suggestedGallons : undefined,
        reason: isFirstRequired
          ? `Fuel stop ${stops.length + 1}: fill here to continue toward destination (${roundMiles(remainingMiles)} mi remaining).`
          : `Fuel stop ${stops.length + 1}: fill to continue; $${chosen.effectivePricePerGallon.toFixed(3)}/gal.`,
      }),
    );

    usedLocationIds.add(chosen.relayLocationId);
    currentAlong = chosen.absoluteAlongRouteMiles;
    fuelPercent = input.config.sweetSpotMaxPercent;

    const nextRange = calculateFuelRangeEstimate({
      fuelPercent,
      tankCapacityGallons: input.fuelRange.tankCapacityGallons,
      mpg: input.fuelRange.mpg,
      reserveFuelPercent: input.config.defaultReserveFuelPercent,
    });
    usableRangeMiles = nextRange.usableRangeMiles;
  }

  const remainingAfterCap = destinationAlong - currentAlong;
  if (remainingAfterCap <= usableRangeMiles) {
    return {
      stops,
      canReachDestination: true,
      cheapestOnRoute,
    };
  }

  return {
    stops,
    canReachDestination: false,
    blockedReason: `Fuel stop plan hit the maximum of ${maxFuelStops} stops with ${roundMiles(remainingAfterCap)} mi still remaining.`,
    cheapestOnRoute,
  };
}

/**
 * Builds the dispatcher-facing fuel plan from a range chain.
 * `stops` is the required CoPilot chain; `now`/`then` are derived for existing UI.
 */
export function buildFuelPlanFromChain(input: {
  fuelPercent: number;
  config: RecommendationConfigValues;
  chain: FuelStopChainResult;
}): FuelPlanView {
  const isLowFuel = input.fuelPercent < input.config.sweetSpotMinPercent;
  const { stops, canReachDestination, blockedReason, cheapestOnRoute } = input.chain;

  if (!cheapestOnRoute && stops.length === 0) {
    return {
      isLowFuel,
      canReachCheapestDirectly: false,
      canReachDestination,
      blockedReason,
      stops: [],
    };
  }

  const primaryCheapest = cheapestOnRoute ?? stops[0]!;
  const canReachCheapestDirectly =
    Boolean(cheapestOnRoute) &&
    (stops.length === 0 ||
      (stops.length === 1 && stops[0]?.relayLocationId === cheapestOnRoute?.relayLocationId));

  // Opportunistic UI: if no required stops but cheapest is on route, surface it as `now`.
  if (stops.length === 0 && cheapestOnRoute) {
    return {
      isLowFuel,
      canReachCheapestDirectly: true,
      canReachDestination,
      blockedReason,
      cheapestOnRoute: primaryCheapest,
      stops: [],
      now: {
        ...cheapestOnRoute,
        reason: isLowFuel
          ? "Fuel is low. Fill enough here to finish comfortably, or fill fully if this is the cheapest option."
          : cheapestOnRoute.reason,
      },
    };
  }

  return {
    isLowFuel,
    canReachCheapestDirectly,
    canReachDestination,
    blockedReason,
    cheapestOnRoute: primaryCheapest,
    stops,
    now: stops[0],
    then: stops[1],
  };
}
