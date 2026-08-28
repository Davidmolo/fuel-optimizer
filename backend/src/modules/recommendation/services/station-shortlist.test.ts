import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateFuelRangeEstimate } from "./fuel-range";
import { RECOMMENDATION_CONFIG_DEFAULTS } from "../constants";
import { shortlistStationsForRouting } from "./station-shortlist";
import { resolveContractPricing } from "../../contract/services/contract-pricing.engine";
import type { MerchantContractRule } from "../../contract/services/contract-pricing.engine";

describe("shortlistStationsForRouting", () => {
  const config = { ...RECOMMENDATION_CONFIG_DEFAULTS };
  const truckPosition = { lat: 35, lng: -90 };
  const routePolyline = [
    { lat: 35, lng: -90 },
    { lat: 36, lng: -89 },
    { lat: 37, lng: -88 },
  ];
  const fuelRange = calculateFuelRangeEstimate({
    fuelPercent: 60,
    tankCapacityGallons: 150,
    mpg: 6.5,
    reserveFuelPercent: 15,
  });

  const contracts: MerchantContractRule[] = [
    {
      merchantKey: "loves",
      merchantDisplayName: "Love's",
      rateAdjustmentPerGallon: -0.06,
      isActive: true,
    },
  ];

  const stations = [
    {
      relayAccount: "blue_stallion" as const,
      relayLocationId: "near-route",
      merchantName: "Love's",
      latitude: 35.4,
      longitude: -89.6,
      discountedPricePerUnit: 3.5,
      isActive: true,
    },
    {
      relayAccount: "blue_stallion" as const,
      relayLocationId: "far-away",
      merchantName: "Love's",
      latitude: 39,
      longitude: -85,
      discountedPricePerUnit: 3.5,
      isActive: true,
    },
  ];

  const pricingByLocationId = new Map(
    stations.map((station) => [
      station.relayLocationId,
      resolveContractPricing(
        {
          relayLocationId: station.relayLocationId,
          merchantName: station.merchantName,
          discountedPricePerUnit: station.discountedPricePerUnit,
        },
        contracts,
      ),
    ]),
  );

  it("caps routing lookups and excludes far-off stations before Google", () => {
    const cappedConfig = { ...config, maxRoutingLookups: 1 };
    const result = shortlistStationsForRouting({
      truckPosition,
      routePolyline,
      fuelRange,
      config: cappedConfig,
      stations: stations as never,
      pricingByLocationId,
    });

    assert.equal(result.stats.shortlistedForRouting, 1);
    assert.equal(result.stations[0]?.relayLocationId, "near-route");
    assert.equal(result.stats.withinPreFilterDistance, 1);
  });
});
