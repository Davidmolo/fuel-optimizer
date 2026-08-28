import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  haversineDistanceMiles,
  isPointAheadOnPolyline,
  isPointInCorridor,
  minDistanceToPolylineMiles,
  buildPolylineBoundingBox,
} from "../../../utils/geo";
import { calculateFuelRangeEstimate } from "./fuel-range";
import { buildRecommendationRoutePolyline, buildRoutePolyline } from "./route-corridor";
import { rankFuelStops } from "./recommendation.engine";
import type { MerchantContractRule } from "../../contract/services/contract-pricing.engine";
import { resolveContractPricing } from "../../contract/services/contract-pricing.engine";

describe("calculateFuelRangeEstimate", () => {
  it("computes usable range from fuel percent with reserve", () => {
    const estimate = calculateFuelRangeEstimate({
      fuelPercent: 50,
      tankCapacityGallons: 100,
      mpg: 10,
      reserveFuelPercent: 10,
    });

    assert.equal(estimate.remainingGallons, 50);
    assert.equal(estimate.reserveGallons, 10);
    assert.equal(estimate.usableGallons, 40);
    assert.equal(estimate.usableRangeMiles, 400);
  });

  it("falls back to default tank capacity when live telemetry stores zero gallons", () => {
    const estimate = calculateFuelRangeEstimate({
      fuelPercent: 68,
      tankCapacityGallons: 0,
      mpg: 6.5,
      reserveFuelPercent: 15,
    });

    assert.equal(estimate.tankCapacityGallons, 150);
    assert.equal(estimate.usableGallons, 79.5);
    assert.ok(estimate.usableRangeMiles > 0);
  });
});

describe("buildRoutePolyline", () => {
  it("orders stops and prepends truck position", () => {
    const polyline = buildRoutePolyline({
      truckPosition: { lat: 35, lng: -90 },
      destinations: [
        { position: 2, stopType: "delivery", completed: false, lat: 36, lng: -88 },
        { position: 1, stopType: "pick_up", completed: false, lat: 35.5, lng: -89 },
      ],
    });

    assert.deepEqual(polyline, [
      { lat: 35, lng: -90 },
      { lat: 35.5, lng: -89 },
      { lat: 36, lng: -88 },
    ]);
  });

  it("builds a forward-only polyline after completed pickup", () => {
    const polyline = buildRecommendationRoutePolyline({
      truckPosition: { lat: 41, lng: -88 },
      destinations: [
        { position: 1, stopType: "pick_up", completed: true, lat: 41.62, lng: -88.24 },
        { position: 2, stopType: "delivery", completed: false, lat: 41.68, lng: -88.05 },
      ],
    });

    assert.deepEqual(polyline, [
      { lat: 41, lng: -88 },
      { lat: 41.68, lng: -88.05 },
    ]);
  });

  it("does not backtrack through completed pickup when using recommendation polyline", () => {
    const withCompleted = buildRoutePolyline({
      truckPosition: { lat: 41, lng: -88 },
      destinations: [
        { position: 1, stopType: "pick_up", completed: true, lat: 41.62, lng: -88.24 },
        { position: 2, stopType: "delivery", completed: false, lat: 41.68, lng: -88.05 },
      ],
      includeCompletedStops: true,
    });
    const recommendationPolyline = buildRecommendationRoutePolyline({
      truckPosition: { lat: 41, lng: -88 },
      destinations: [
        { position: 1, stopType: "pick_up", completed: true, lat: 41.62, lng: -88.24 },
        { position: 2, stopType: "delivery", completed: false, lat: 41.68, lng: -88.05 },
      ],
    });

    assert.equal(withCompleted.length, 3);
    assert.equal(recommendationPolyline.length, 2);
    assert.notDeepEqual(recommendationPolyline, withCompleted);
  });
});

describe("geo corridor helpers", () => {
  it("treats points near a segment as inside the corridor", () => {
    const polyline = [
      { lat: 35, lng: -90 },
      { lat: 36, lng: -90 },
    ];
    const nearPoint = { lat: 35.5, lng: -90.1 };

    assert.equal(isPointInCorridor(nearPoint, polyline, 10), true);
    assert.ok(minDistanceToPolylineMiles(nearPoint, polyline) < 10);
  });

  it("builds a padded bounding box around a route", () => {
    const polyline = [
      { lat: 35, lng: -90 },
      { lat: 36, lng: -90 },
    ];
    const boundingBox = buildPolylineBoundingBox(polyline, 25);

    assert.ok(boundingBox);
    assert.ok(boundingBox.minLat < 35);
    assert.ok(boundingBox.maxLat > 36);
    assert.ok(boundingBox.minLng < -90);
    assert.ok(boundingBox.maxLng > -90);
  });
});

describe("rankFuelStops", () => {
  const contracts: MerchantContractRule[] = [
    {
      merchantKey: "loves",
      merchantDisplayName: "Love's",
      rateAdjustmentPerGallon: -0.06,
      isActive: true,
    },
    {
      merchantKey: "pilot",
      merchantDisplayName: "Pilot",
      rateAdjustmentPerGallon: -0.03,
      isActive: true,
    },
  ];

  const routePolyline = [
    { lat: 35, lng: -90 },
    { lat: 36, lng: -89 },
    { lat: 37, lng: -88 },
  ];

  const truckPosition = { lat: 35, lng: -90 };
  const fuelRange = calculateFuelRangeEstimate({
    fuelPercent: 60,
    tankCapacityGallons: 150,
    mpg: 6.5,
    reserveFuelPercent: 15,
  });

  const stations = [
    {
      station: {
        relayAccount: "blue_stallion" as const,
        relayLocationId: "loves-ahead",
        merchantName: "Love's",
        name: "Love's Ahead",
        city: "Memphis",
        state: "TN",
        latitude: 35.4,
        longitude: -89.6,
        discountedPricePerUnit: 3.5,
      },
      pricing: resolveContractPricing(
        {
          relayLocationId: "loves-ahead",
          merchantName: "Love's",
          discountedPricePerUnit: 3.5,
        },
        contracts,
      ),
    },
    {
      station: {
        relayAccount: "blue_stallion" as const,
        relayLocationId: "pilot-ahead",
        merchantName: "Pilot",
        name: "Pilot Ahead",
        city: "Jackson",
        state: "TN",
        latitude: 35.45,
        longitude: -89.55,
        discountedPricePerUnit: 3.4,
      },
      pricing: resolveContractPricing(
        {
          relayLocationId: "pilot-ahead",
          merchantName: "Pilot",
          discountedPricePerUnit: 3.4,
        },
        contracts,
      ),
    },
    {
      station: {
        relayAccount: "blue_stallion" as const,
        relayLocationId: "loves-behind",
        merchantName: "Love's",
        name: "Love's Behind",
        latitude: 34.9,
        longitude: -90.1,
        discountedPricePerUnit: 3.1,
      },
      pricing: resolveContractPricing(
        {
          relayLocationId: "loves-behind",
          merchantName: "Love's",
          discountedPricePerUnit: 3.1,
        },
        contracts,
      ),
    },
    {
      station: {
        relayAccount: "blue_stallion" as const,
        relayLocationId: "loves-far",
        merchantName: "Love's",
        name: "Love's Far",
        latitude: 39,
        longitude: -85,
        discountedPricePerUnit: 3.0,
      },
      pricing: resolveContractPricing(
        {
          relayLocationId: "loves-far",
          merchantName: "Love's",
          discountedPricePerUnit: 3.0,
        },
        contracts,
      ),
    },
    {
      station: {
        relayAccount: "blue_stallion" as const,
        relayLocationId: "no-contract",
        merchantName: "TA Petro",
        name: "TA Petro",
        latitude: 35.42,
        longitude: -89.58,
        discountedPricePerUnit: 3.2,
      },
      pricing: resolveContractPricing(
        {
          relayLocationId: "no-contract",
          merchantName: "TA Petro",
          discountedPricePerUnit: 3.2,
        },
        contracts,
      ),
    },
  ];

  it("filters corridor, range, ahead, and contracted stations", () => {
    const result = rankFuelStops({
      truckPosition,
      routePolyline,
      fuelRange,
      stations,
      options: { corridorBufferMiles: 25, maxAlternates: 2, useEstimatedDistances: true },
    });

    assert.equal(result.filterStats.totalStations, 5);
    assert.equal(result.filterStats.contractedAndPriced, 2);
    assert.equal(result.filterStats.candidates, 2);
    assert.ok(result.primary);
    assert.equal(result.primary?.relayLocationId, "pilot-ahead");
    assert.equal(result.alternates.length, 1);
    assert.equal(result.alternates[0]?.relayLocationId, "loves-ahead");
  });

  it("ranks by effective price then distance", () => {
    const closerLoves = {
      station: {
        relayAccount: "blue_stallion" as const,
        relayLocationId: "loves-close",
        merchantName: "Love's",
        latitude: 35.2,
        longitude: -89.8,
        discountedPricePerUnit: 3.44,
      },
      pricing: resolveContractPricing(
        {
          relayLocationId: "loves-close",
          merchantName: "Love's",
          discountedPricePerUnit: 3.44,
        },
        contracts,
      ),
    };

    const fartherLoves = {
      station: {
        relayAccount: "blue_stallion" as const,
        relayLocationId: "loves-farther",
        merchantName: "Love's",
        latitude: 35.6,
        longitude: -89.4,
        discountedPricePerUnit: 3.44,
      },
      pricing: resolveContractPricing(
        {
          relayLocationId: "loves-farther",
          merchantName: "Love's",
          discountedPricePerUnit: 3.44,
        },
        contracts,
      ),
    };

    const result = rankFuelStops({
      truckPosition,
      routePolyline,
      fuelRange,
      stations: [fartherLoves, closerLoves],
      options: { corridorBufferMiles: 25, maxAlternates: 1, useEstimatedDistances: true },
    });

    assert.equal(result.primary?.relayLocationId, "loves-close");
    assert.equal(result.alternates[0]?.relayLocationId, "loves-farther");
  });

  it("returns no candidates when route polyline is too short", () => {
    const result = rankFuelStops({
      truckPosition,
      routePolyline: [truckPosition],
      fuelRange,
      stations,
    });

    assert.equal(result.primary, undefined);
    assert.equal(result.filterStats.candidates, 0);
  });

  it("uses road driving distances when provided", () => {
    const drivingDistances = new Map([
      ["pilot-ahead", { distanceMiles: 18, durationMinutes: 22 }],
      ["loves-ahead", { distanceMiles: 24, durationMinutes: 28 }],
    ]);

    const result = rankFuelStops({
      truckPosition,
      routePolyline,
      fuelRange,
      stations: [stations[0], stations[1]],
      drivingDistances,
      options: { corridorBufferMiles: 25, maxAlternates: 1 },
    });

    assert.equal(result.primary?.relayLocationId, "pilot-ahead");
    assert.equal(result.primary?.distanceMiles, 18);
    assert.equal(result.primary?.drivingDurationMinutes, 22);
    assert.equal(result.alternates[0]?.relayLocationId, "loves-ahead");
  });

  it("excludes stations without a road route result", () => {
    const drivingDistances = new Map([
      ["pilot-ahead", { distanceMiles: 18, durationMinutes: 22 }],
    ]);

    const result = rankFuelStops({
      truckPosition,
      routePolyline,
      fuelRange,
      stations: [stations[0], stations[1]],
      drivingDistances,
      options: { corridorBufferMiles: 25, maxAlternates: 1 },
    });

    assert.equal(result.filterStats.candidates, 1);
    assert.equal(result.primary?.relayLocationId, "pilot-ahead");
  });

  it("excludes stations when along-route distance exceeds usable range", () => {
    const tightRange = calculateFuelRangeEstimate({
      fuelPercent: 16,
      tankCapacityGallons: 100,
      mpg: 6.5,
      reserveFuelPercent: 15,
    });

    const result = rankFuelStops({
      truckPosition,
      routePolyline,
      fuelRange: tightRange,
      stations: [stations[0], stations[1]],
      options: { corridorBufferMiles: 25, maxAlternates: 1, useEstimatedDistances: true },
    });

    assert.ok(tightRange.usableRangeMiles < 10);
    assert.equal(result.filterStats.aheadOnRoute, 2);
    assert.equal(result.filterStats.withinRange, 0);
    assert.equal(result.filterStats.candidates, 0);
  });

  it("excludes stations beyond road driving range", () => {
    const drivingDistances = new Map([
      ["pilot-ahead", { distanceMiles: 500, durationMinutes: 480 }],
      ["loves-ahead", { distanceMiles: 5, durationMinutes: 8 }],
    ]);

    const tightRange = calculateFuelRangeEstimate({
      fuelPercent: 16,
      tankCapacityGallons: 100,
      mpg: 6.5,
      reserveFuelPercent: 15,
    });

    const result = rankFuelStops({
      truckPosition,
      routePolyline,
      fuelRange: tightRange,
      stations: [stations[0], stations[1]],
      drivingDistances,
      options: { corridorBufferMiles: 25, maxAlternates: 1 },
    });

    assert.equal(result.filterStats.withinRange, 1);
    assert.equal(result.primary?.relayLocationId, "loves-ahead");
  });
});

describe("isPointAheadOnPolyline", () => {
  it("marks downstream points as ahead of the truck", () => {
    const polyline = [
      { lat: 35, lng: -90 },
      { lat: 36, lng: -89 },
    ];

    assert.equal(isPointAheadOnPolyline({ lat: 35.8, lng: -89.2 }, { lat: 35, lng: -90 }, polyline), true);
    assert.equal(isPointAheadOnPolyline({ lat: 34.8, lng: -90.2 }, { lat: 35, lng: -90 }, polyline, 1), false);
  });

  it("computes non-zero distance between separated coordinates", () => {
    const distance = haversineDistanceMiles({ lat: 35, lng: -90 }, { lat: 36, lng: -90 });
    assert.ok(distance > 60);
  });
});
