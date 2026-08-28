import { HttpError } from "../../../utils/http-error";
import { env } from "../../../config/env";
import { buildPolylineBoundingBox } from "../../../utils/geo";
import type { RelayAccount } from "../../../integrations/relay";
import { PAULS_ASSETS_SLUG } from "../../contract/constants";
import {
  getCustomerBySlug,
  loadActiveContractRules,
} from "../../contract/services/contract-pricing.service";
import { resolveContractPricing } from "../../contract/services/contract-pricing.engine";
import { FuelStationModel } from "../../station/models/fuel-station.model";
import { getTripContext } from "../../tms/services/tms-query.service";
import { getRecommendationConfig } from "../../recommendation-config/services/recommendation-config.service";
import { buildRecommendationView } from "../mappers/recommendation.mapper";
import { calculateFuelRangeEstimate, resolveTankCapacityGallons } from "./fuel-range";
import { rankFuelStops } from "./recommendation.engine";
import {
  buildRecommendationRoutePolyline,
  buildRouteCorridor,
  isDegenerateRecommendationRoute,
} from "./route-corridor";
import {
  buildDrivingRoutePolyline,
  fetchDrivingDistancesToStations,
  isRecommendationUsingGoogleRouting,
  isRecommendationUsingTrimbleRouting,
} from "./route-planning.service";
import {
  buildFuelPlan,
  listCorridorStationCandidates,
  listRadialStationCandidates,
} from "./fuel-plan.service";
import {
  buildDemoTripContext,
  getDemoNotReadyMessage,
  resolveDemoFuelPercent,
} from "./recommendation-demo.service";
import { shortlistStationsForRouting } from "./station-shortlist";

type GetRecommendationOptions = {
  customerSlug?: string;
  relayAccount?: RelayAccount;
  demo?: boolean;
  demoFuelPercent?: number;
};

export function isRecommendationDemoAllowed() {
  return env.NODE_ENV !== "production" || env.RECOMMENDATION_DEMO_MODE;
}

function buildNotReadyMessage(tripContext: Awaited<ReturnType<typeof getTripContext>>) {
  const missing: string[] = [];

  if (!tripContext.linkage.hasDriver) {
    missing.push("driver assignment");
  }

  if (!tripContext.linkage.hasTruckAssignment) {
    missing.push("truck assignment");
  }

  if (!tripContext.linkage.hasFleetVehicle) {
    missing.push("linked fleet vehicle");
  }

  if (!tripContext.linkage.hasTelemetry) {
    missing.push("live GPS/fuel telemetry");
  }

  if (!tripContext.load.originCity || !tripContext.load.destinationCity) {
    missing.push("route origin and destination");
  }

  if (missing.length === 0) {
    return "Trip context is not ready for fuel recommendations.";
  }

  return `Trip context is missing ${missing.join(", ")}.`;
}

export async function getRecommendationForTruck(identifier: string, options: GetRecommendationOptions = {}) {
  if (options.demo && !isRecommendationDemoAllowed()) {
    throw new HttpError("Recommendation demo mode is disabled in this environment.", 403);
  }

  const [tripContext, recommendationConfig] = await Promise.all([
    getTripContext(identifier),
    getRecommendationConfig(),
  ]);

  const isDemo = Boolean(options.demo);
  const demoFuelPercent = resolveDemoFuelPercent(options.demoFuelPercent);
  const activeTripContext =
    isDemo ? buildDemoTripContext(tripContext, demoFuelPercent) ?? tripContext : tripContext;

  if (isDemo) {
    if (!activeTripContext.linkage.isReadyForRecommendation || !activeTripContext.vehicle?.gps || !activeTripContext.vehicle.fuel) {
      return buildRecommendationView({
        tripContext: activeTripContext,
        status: "not_ready",
        message: getDemoNotReadyMessage(tripContext),
        isDemo: true,
      });
    }
  } else if (!tripContext.linkage.isReadyForRecommendation) {
    return buildRecommendationView({
      tripContext,
      status: "not_ready",
      message: buildNotReadyMessage(tripContext),
    });
  }

  const truckLatitude = activeTripContext.vehicle?.gps?.latitude;
  const truckLongitude = activeTripContext.vehicle?.gps?.longitude;
  const fuelPercent = activeTripContext.vehicle?.fuel?.percent;

  if (truckLatitude === undefined || truckLongitude === undefined || fuelPercent === undefined) {
    return buildRecommendationView({
      tripContext: activeTripContext,
      status: "not_ready",
      message: isDemo
        ? getDemoNotReadyMessage(tripContext)
        : "Live truck GPS and fuel telemetry are required for recommendations.",
      isDemo,
    });
  }

  if (
    !isDemo &&
    (activeTripContext.vehicle?.gps?.freshness !== "live" || activeTripContext.vehicle?.fuel?.freshness !== "live")
  ) {
    return buildRecommendationView({
      tripContext: activeTripContext,
      status: "not_ready",
      message: "Live GPS and fuel telemetry are required for recommendations.",
    });
  }

  const routeWaypoints = buildRecommendationRoutePolyline({
    truckPosition: { lat: truckLatitude, lng: truckLongitude },
    destinations: activeTripContext.load.destinations,
  });

  if (routeWaypoints.length < 2) {
    return buildRecommendationView({
      tripContext: activeTripContext,
      status: "not_ready",
      message: isDemo
        ? getDemoNotReadyMessage(tripContext)
        : "Route coordinates are unavailable. Sync active loads with geocoded stops.",
      isDemo,
    });
  }

  let routePolyline: Awaited<ReturnType<typeof buildDrivingRoutePolyline>>;

  try {
    routePolyline = await buildDrivingRoutePolyline(routeWaypoints);
  } catch (error) {
    const message =
      error instanceof Error
        ? `Unable to compute driving route: ${error.message}`
        : "Unable to compute driving route from truck position and load stops.";

    return buildRecommendationView({
      tripContext: activeTripContext,
      status: "not_ready",
      message,
      isDemo,
    });
  }

  const useEstimatedDistances = !isRecommendationUsingGoogleRouting();
  const routingProvider = isRecommendationUsingTrimbleRouting()
    ? ("trimble" as const)
    : ("osrm" as const);
  const corridorSearchMiles = Math.max(
    routePolyline.routeLengthMiles,
    recommendationConfig.maxSearchAheadMiles,
  );

  const fuelRange = calculateFuelRangeEstimate({
    fuelPercent,
    tankCapacityGallons: resolveTankCapacityGallons(
      activeTripContext.vehicle?.fuelTankCapacityGallons,
      recommendationConfig.defaultTankCapacityGallons,
    ),
    mpg: recommendationConfig.defaultMpg,
    reserveFuelPercent: recommendationConfig.defaultReserveFuelPercent,
  });

  if (fuelRange.usableRangeMiles <= 0) {
    const lowFuelMessage =
      fuelPercent <= recommendationConfig.defaultReserveFuelPercent
        ? "Remaining fuel is below the reserve threshold. Refuel before requesting recommendations."
        : "Remaining usable fuel range is zero. Check tank capacity settings or refuel before requesting recommendations.";

    return buildRecommendationView({
      tripContext: activeTripContext,
      status: "not_ready",
      message: lowFuelMessage,
      fuelRange,
      corridor: {
        bufferMiles: recommendationConfig.corridorBufferMiles,
        pointCount: routePolyline.polyline.length,
        routeLengthMiles: routePolyline.routeLengthMiles,
      },
      isDemo,
    });
  }

  const useRadialSearch = isDegenerateRecommendationRoute(routePolyline.routeLengthMiles);
  const searchMode = useRadialSearch ? ("radial" as const) : ("corridor" as const);
  const stationSearchRadiusMiles = useRadialSearch
    ? Math.min(fuelRange.usableRangeMiles, recommendationConfig.maxSearchAheadMiles)
    : corridorSearchMiles;

  const corridor = buildRouteCorridor(routePolyline.polyline, recommendationConfig.corridorBufferMiles);
  const customerSlug = options.customerSlug ?? PAULS_ASSETS_SLUG;
  const customer = await getCustomerBySlug(customerSlug);
  const contractRules = await loadActiveContractRules(String(customer._id));

  const stationFilter: Record<string, unknown> = { isActive: true };

  if (options.relayAccount) {
    stationFilter.relayAccount = options.relayAccount;
  }

  // Rely on bounding box + corridor geometry instead of stop-state filtering.
  // Long-haul routes pass through many states that are not listed on TMS stops.

  const boundingBox = buildPolylineBoundingBox(
    [{ lat: truckLatitude, lng: truckLongitude }, ...routePolyline.polyline],
    stationSearchRadiusMiles,
  );

  if (boundingBox) {
    stationFilter.latitude = { $gte: boundingBox.minLat, $lte: boundingBox.maxLat };
    stationFilter.longitude = { $gte: boundingBox.minLng, $lte: boundingBox.maxLng };
  }

  const stations = await FuelStationModel.find(stationFilter).lean();
  const pricingByLocationId = new Map(
    stations.map((station) => [
      station.relayLocationId,
      resolveContractPricing(
        {
          relayLocationId: station.relayLocationId,
          merchantName: station.merchantName,
          retailPricePerUnit: station.retailPricePerUnit,
          discountedPricePerUnit: station.discountedPricePerUnit,
        },
        contractRules,
      ),
    ]),
  );

  const corridorStations = useRadialSearch
    ? listRadialStationCandidates({
        truckPosition: { lat: truckLatitude, lng: truckLongitude },
        usableRangeMiles: fuelRange.usableRangeMiles,
        config: recommendationConfig,
        stations,
        pricingByLocationId,
      })
    : listCorridorStationCandidates({
        truckPosition: { lat: truckLatitude, lng: truckLongitude },
        routePolyline: routePolyline.polyline,
        config: recommendationConfig,
        stations,
        pricingByLocationId,
        usableRangeMiles: corridorSearchMiles,
      });

  const shortlist = shortlistStationsForRouting({
    truckPosition: { lat: truckLatitude, lng: truckLongitude },
    routePolyline: routePolyline.polyline,
    fuelRange,
    config: recommendationConfig,
    stations,
    pricingByLocationId,
  });

  let drivingDistances: Awaited<ReturnType<typeof fetchDrivingDistancesToStations>> | undefined;

  if (!useEstimatedDistances) {
    try {
      drivingDistances = await fetchDrivingDistancesToStations({
        truckPosition: { lat: truckLatitude, lng: truckLongitude },
        stations: shortlist.stations.map((station) => ({
          relayLocationId: station.relayLocationId,
          latitude: station.latitude as number,
          longitude: station.longitude as number,
        })),
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? `Unable to compute driving distances to fuel stations: ${error.message}`
          : "Unable to compute driving distances to fuel stations.";

      return buildRecommendationView({
        tripContext: activeTripContext,
        status: "not_ready",
        message,
        fuelRange,
        corridor: {
          bufferMiles: corridor.bufferMiles,
          pointCount: corridor.pointCount,
          routeLengthMiles: routePolyline.routeLengthMiles,
        },
        routingProvider,
        isDemo,
      });
    }
  }

  const rankedStationInputs =
    useEstimatedDistances || useRadialSearch
      ? stations
          .filter((station) => pricingByLocationId.get(station.relayLocationId)?.available)
          .map((station) => ({
            station,
            pricing: pricingByLocationId.get(station.relayLocationId)!,
          }))
      : shortlist.stations.map((station) => ({
          station,
          pricing: pricingByLocationId.get(station.relayLocationId)!,
        }));

  const ranked = rankFuelStops({
    truckPosition: { lat: truckLatitude, lng: truckLongitude },
    routePolyline: routePolyline.polyline,
    fuelRange,
    stations: rankedStationInputs,
    drivingDistances,
    options: {
      corridorBufferMiles: recommendationConfig.corridorBufferMiles,
      maxAlternates: recommendationConfig.maxAlternates,
      aheadToleranceMiles: recommendationConfig.minAheadOnRouteMiles,
      useEstimatedDistances: useEstimatedDistances || useRadialSearch,
      searchMode,
    },
  });

  const filterStats = {
    ...ranked.filterStats,
    totalStations: shortlist.stats.totalStations,
    withCoordinates: shortlist.stats.withCoordinates,
    inCorridor: shortlist.stats.inCorridor,
    aheadOnRoute: shortlist.stats.aheadOnRoute,
    withinPreFilterDistance: shortlist.stats.withinPreFilterDistance,
    shortlistedForRouting: shortlist.stats.shortlistedForRouting,
  };

  const cheapestOnRoute = corridorStations[0];
  const fuelPlan =
    cheapestOnRoute
      ? buildFuelPlan({
          fuelPercent,
          fuelRange,
          config: recommendationConfig,
          cheapestOnRoute,
          primaryWithinRange: ranked.primary,
        })
      : undefined;

  if (!ranked.primary && !cheapestOnRoute) {
    return buildRecommendationView({
      tripContext: activeTripContext,
      status: "no_candidates",
      message: useRadialSearch
        ? "No contracted fuel stops found within your remaining fuel range near the truck."
        : "No contracted fuel stops matched the route corridor and remaining fuel range.",
      fuelRange,
      corridor: {
        bufferMiles: corridor.bufferMiles,
        pointCount: corridor.pointCount,
        routeLengthMiles: routePolyline.routeLengthMiles,
      },
      corridorStations,
      filterStats,
      routingProvider,
      isDemo,
      searchMode,
    });
  }

  const primary = ranked.primary ?? (cheapestOnRoute ? {
    relayAccount: cheapestOnRoute.relayAccount,
    relayLocationId: cheapestOnRoute.relayLocationId,
    merchantName: cheapestOnRoute.merchantName,
    name: cheapestOnRoute.name,
    city: cheapestOnRoute.city,
    state: cheapestOnRoute.state,
    latitude: cheapestOnRoute.latitude,
    longitude: cheapestOnRoute.longitude,
    effectivePricePerGallon: cheapestOnRoute.effectivePricePerGallon,
    distanceMiles: cheapestOnRoute.distanceAlongRouteMiles,
    drivingDurationMinutes: 0,
    distanceAlongRouteMiles: cheapestOnRoute.distanceAlongRouteMiles,
    corridorDistanceMiles: 0,
    pricing: pricingByLocationId.get(cheapestOnRoute.relayLocationId)! as Extract<
      Awaited<ReturnType<typeof resolveContractPricing>>,
      { available: true }
    >,
  } : undefined);

  if (!primary) {
    return buildRecommendationView({
      tripContext: activeTripContext,
      status: "no_candidates",
      message: "No contracted fuel stops matched the route corridor.",
      fuelRange,
      corridor: {
        bufferMiles: corridor.bufferMiles,
        pointCount: corridor.pointCount,
        routeLengthMiles: routePolyline.routeLengthMiles,
      },
      corridorStations,
      filterStats,
      routingProvider,
      isDemo,
      searchMode,
    });
  }

  const demoPrefix = isDemo ? "[Demo] " : "";
  const atDestinationPrefix = useRadialSearch ? "At/near destination — " : "";

  return buildRecommendationView({
    tripContext: activeTripContext,
    status: "ready",
    message: `${demoPrefix}${atDestinationPrefix}${
      fuelPlan?.canReachCheapestDirectly
        ? `Cheapest contracted stop on route: ${primary.merchantName ?? primary.pricing.merchantDisplayName} at $${primary.effectivePricePerGallon.toFixed(3)}/gal.`
        : fuelPlan?.now
          ? `Add fuel now, then fill at the cheapest stop ${fuelPlan.then?.distanceAlongRouteMiles ?? fuelPlan.cheapestOnRoute.distanceAlongRouteMiles} mi ahead.`
          : "Fuel stop recommendation generated successfully."
    }`,
    fuelRange,
    corridor: {
      bufferMiles: corridor.bufferMiles,
      pointCount: corridor.pointCount,
      routeLengthMiles: routePolyline.routeLengthMiles,
    },
    primary,
    alternates: ranked.alternates,
    corridorStations,
    fuelPlan,
    filterStats,
    routingProvider,
    isDemo,
    searchMode,
  });
}

export async function getRecommendationByQuery(options: {
  truckId: string;
} & GetRecommendationOptions) {
  if (!options.truckId.trim()) {
    throw new HttpError("truckId is required", 400);
  }

  return getRecommendationForTruck(options.truckId, options);
}
