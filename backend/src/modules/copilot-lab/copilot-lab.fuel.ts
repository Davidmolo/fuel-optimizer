import { PAULS_ASSETS_SLUG } from "../contract/constants";
import { getCustomerBySlug, loadActiveContractRules } from "../contract/services/contract-pricing.service";
import { resolveContractPricing } from "../contract/services/contract-pricing.engine";
import { buildDrivingRoutePolyline } from "../recommendation/services/route-planning.service";
import {
  buildFuelStopChain,
  buildFuelPlanFromChain,
  corridorStationsToChainCandidates,
} from "../recommendation/services/fuel-stop-chain";
import { listCorridorStationCandidates } from "../recommendation/services/fuel-plan.service";
import { calculateFuelRangeEstimate } from "../recommendation/services/fuel-range";
import { getRecommendationConfig } from "../recommendation-config/services/recommendation-config.service";
import { relayDieselPriceFields, selectFreshestStations } from "../station/mappers/fuel-station.mapper";
import { FuelStationModel } from "../station/models/fuel-station.model";
import type { FuelStopStationInput } from "../tms/services/fuel-stop-builder";
import { HttpError } from "../../utils/http-error";
import {
  buildPolylineBoundingBox,
  distanceAlongPolylineMiles,
  polylineLengthMiles,
  type GeoPoint,
} from "../../utils/geo";
import type { LabFuelMode, LabPoint } from "./copilot-lab.rules";

/** Low enough that a long corridor needs fuel, high enough to leave a short hop uncovered. */
export const LAB_ASSUMED_FUEL_PERCENT = 25;

export type ResolvedLabFuel = {
  stations: FuelStopStationInput[];
  polyline: GeoPoint[];
  note?: string;
};

function toGeo(point: LabPoint): GeoPoint {
  return { lat: point.lat, lng: point.lon };
}

function manualStations(stops: LabPoint[]): FuelStopStationInput[] {
  return stops.map((stop) => {
    const label = stop.label?.trim();
    return {
      latitude: stop.lat,
      longitude: stop.lon,
      name: label || "Fuel stop",
      merchantName: label || undefined,
    };
  });
}

async function routeEnds(origin: LabPoint, destination: LabPoint, fuelMode: LabFuelMode) {
  try {
    const route = await buildDrivingRoutePolyline([toGeo(origin), toGeo(destination)]);
    return route;
  } catch (error) {
    if (fuelMode === "recommendation") {
      const message = error instanceof Error ? error.message : String(error);
      throw new HttpError(`Unable to route this lab trip for a fuel plan: ${message}`, 502);
    }
    return {
      polyline: [toGeo(origin), toGeo(destination)],
      routeLengthMiles: 0,
      durationMinutes: 0,
    };
  }
}

async function recommendStations(origin: LabPoint, polyline: GeoPoint[]) {
  const config = await getRecommendationConfig();
  const routeLengthMiles = polylineLengthMiles(polyline);
  const fuelRange = calculateFuelRangeEstimate({
    fuelPercent: LAB_ASSUMED_FUEL_PERCENT,
    tankCapacityGallons: config.defaultTankCapacityGallons,
    mpg: config.defaultMpg,
    reserveFuelPercent: config.defaultReserveFuelPercent,
  });

  const boundingBox = buildPolylineBoundingBox(polyline, Math.max(routeLengthMiles, config.maxSearchAheadMiles));
  if (!boundingBox) {
    throw new HttpError("Could not bound this route for a fuel search.", 400);
  }

  const customer = await getCustomerBySlug(PAULS_ASSETS_SLUG);
  const contractRules = await loadActiveContractRules(String(customer._id));
  const stations = selectFreshestStations(
    await FuelStationModel.find({
      isActive: true,
      latitude: { $gte: boundingBox.minLat, $lte: boundingBox.maxLat },
      longitude: { $gte: boundingBox.minLng, $lte: boundingBox.maxLng },
    }).lean(),
  );

  const pricingByLocationId = new Map(
    stations.map((station) => [
      station.relayLocationId,
      resolveContractPricing(
        {
          relayLocationId: station.relayLocationId,
          merchantName: station.merchantName,
          ...relayDieselPriceFields(station),
        },
        contractRules,
      ),
    ]),
  );

  const truckAlongRouteMiles = distanceAlongPolylineMiles(toGeo(origin), polyline);
  const corridorStations = listCorridorStationCandidates({
    truckPosition: toGeo(origin),
    routePolyline: polyline,
    config,
    stations,
    pricingByLocationId,
    usableRangeMiles: Math.max(routeLengthMiles, fuelRange.usableRangeMiles),
  });

  const chain = buildFuelStopChain({
    currentAlongRouteMiles: truckAlongRouteMiles,
    destinationAlongRouteMiles: routeLengthMiles,
    fuelPercent: LAB_ASSUMED_FUEL_PERCENT,
    fuelRange,
    config,
    candidates: corridorStationsToChainCandidates(corridorStations, truckAlongRouteMiles),
  });

  const fuelPlan = buildFuelPlanFromChain({
    fuelPercent: LAB_ASSUMED_FUEL_PERCENT,
    config,
    chain,
  });

  const assumed = `Fuel plan assumed ${LAB_ASSUMED_FUEL_PERCENT}% of a ${config.defaultTankCapacityGallons} gal tank.`;

  if (!fuelPlan.canReachDestination && (fuelPlan.stops?.length ?? 0) === 0) {
    throw new HttpError(
      fuelPlan.blockedReason || chain.blockedReason || `${assumed} No contracted stop can cover this route.`,
      409,
    );
  }

  const planned = (fuelPlan.stops ?? []).filter(
    (stop) => typeof stop.latitude === "number" && typeof stop.longitude === "number",
  );

  if (planned.length === 0) {
    return {
      stations: [] as FuelStopStationInput[],
      note: `${assumed} No fuel stop is required to finish this route.`,
    };
  }

  return {
    stations: planned.map((stop) => ({
      latitude: stop.latitude as number,
      longitude: stop.longitude as number,
      merchantName: stop.merchantDisplayName,
      name: stop.name,
      city: stop.city,
      state: stop.state,
      suggestedGallons: stop.suggestedGallons,
    })),
    note: `${assumed} ${planned.length} fuel stop(s) selected.`,
  };
}

export async function resolveLabFuel(input: {
  origin: LabPoint;
  destination: LabPoint;
  fuelMode: LabFuelMode;
  manualStops: LabPoint[];
}): Promise<ResolvedLabFuel> {
  const route = await routeEnds(input.origin, input.destination, input.fuelMode);

  if (input.fuelMode === "none") {
    return { stations: [], polyline: route.polyline };
  }

  if (input.fuelMode === "manual") {
    if (input.manualStops.length === 0) {
      throw new HttpError("Add at least one fuel stop, or choose another fuel option.", 400);
    }
    return {
      stations: manualStations(input.manualStops),
      polyline: route.polyline,
      note: `Requested ${input.manualStops.length} manual fuel stop(s).`,
    };
  }

  const recommended = await recommendStations(input.origin, route.polyline);
  return {
    stations: recommended.stations,
    polyline: route.polyline,
    note: recommended.note,
  };
}
