import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RECOMMENDATION_CONFIG_DEFAULTS } from "../constants";
import {
  buildFuelPlanFromChain,
  buildFuelStopChain,
  type FuelStopChainCandidate,
} from "./fuel-stop-chain";

const config = { ...RECOMMENDATION_CONFIG_DEFAULTS };

function candidate(
  id: string,
  absoluteAlongRouteMiles: number,
  price: number,
  extras: Partial<FuelStopChainCandidate> = {},
): FuelStopChainCandidate {
  return {
    relayAccount: "azfs",
    relayLocationId: id,
    merchantDisplayName: id,
    merchantName: id,
    name: id,
    city: "City",
    state: "TX",
    latitude: 32 + absoluteAlongRouteMiles / 1000,
    longitude: -97,
    effectivePricePerGallon: price,
    absoluteAlongRouteMiles,
    ...extras,
  };
}

const baseFuelRange = {
  mpg: 6.5,
  usableGallons: 50,
  usableRangeMiles: 325, // 50 * 6.5
  tankCapacityGallons: 150,
};

describe("buildFuelStopChain", () => {
  it("returns no stops when remaining distance is within usable range", () => {
    const result = buildFuelStopChain({
      currentAlongRouteMiles: 0,
      destinationAlongRouteMiles: 200,
      fuelPercent: 50,
      fuelRange: baseFuelRange,
      config,
      candidates: [candidate("cheap", 100, 3.1), candidate("far", 180, 3.5)],
    });

    assert.equal(result.canReachDestination, true);
    assert.equal(result.stops.length, 0);
    assert.equal(result.cheapestOnRoute?.relayLocationId, "cheap");
  });

  it("plans one stop when destination is just beyond current range", () => {
    const result = buildFuelStopChain({
      currentAlongRouteMiles: 0,
      destinationAlongRouteMiles: 400,
      fuelPercent: 40,
      fuelRange: baseFuelRange,
      config,
      candidates: [candidate("mid", 250, 3.2), candidate("near", 50, 3.0)],
    });

    assert.equal(result.canReachDestination, true);
    assert.equal(result.stops.length, 1);
    // Late-window preference (last 35% of 325 mi ≈ from 211) prefers mid over near.
    assert.equal(result.stops[0]?.relayLocationId, "mid");
  });

  it("plans multiple stops for a long corridor", () => {
    // After fill to 75%: usable = 150*0.75 - 150*0.15 = 112.5 - 22.5 = 90 gal → 585 mi
    const result = buildFuelStopChain({
      currentAlongRouteMiles: 0,
      destinationAlongRouteMiles: 1200,
      fuelPercent: 40,
      fuelRange: baseFuelRange,
      config,
      candidates: [
        candidate("a", 250, 3.4),
        candidate("b", 700, 3.1),
        candidate("c", 1050, 3.2),
      ],
    });

    assert.equal(result.canReachDestination, true);
    assert.ok(result.stops.length >= 2);
    assert.equal(result.stops[0]?.relayLocationId, "a");
    assert.ok(result.stops.some((stop) => stop.relayLocationId === "b"));
  });

  it("reports unreachable gap when no station is in range", () => {
    const result = buildFuelStopChain({
      currentAlongRouteMiles: 0,
      destinationAlongRouteMiles: 800,
      fuelPercent: 40,
      fuelRange: baseFuelRange,
      config,
      candidates: [candidate("too-far", 500, 3.0)],
    });

    assert.equal(result.canReachDestination, false);
    assert.equal(result.stops.length, 0);
    assert.match(result.blockedReason ?? "", /No contracted fuel stop/);
  });

  it("respects maxFuelStops cap", () => {
    const candidates = Array.from({ length: 12 }, (_, index) =>
      candidate(`s${index}`, 200 + index * 200, 3.0 + index * 0.01),
    );

    const result = buildFuelStopChain({
      currentAlongRouteMiles: 0,
      destinationAlongRouteMiles: 5000,
      fuelPercent: 30,
      fuelRange: { ...baseFuelRange, usableRangeMiles: 280, usableGallons: 43 },
      config,
      candidates,
      maxFuelStops: 3,
    });

    assert.ok(result.stops.length <= 3);
    if (!result.canReachDestination) {
      assert.match(result.blockedReason ?? "", /maximum of 3/);
    }
  });

  it("prefers cheapest station inside the late reach window", () => {
    const result = buildFuelStopChain({
      currentAlongRouteMiles: 0,
      destinationAlongRouteMiles: 500,
      fuelPercent: 40,
      fuelRange: baseFuelRange,
      config,
      candidates: [
        candidate("early-cheap", 40, 2.9),
        candidate("late-pricey", 280, 3.5),
        candidate("late-cheap", 300, 3.0),
      ],
    });

    assert.equal(result.stops[0]?.relayLocationId, "late-cheap");
  });
});

describe("buildFuelPlanFromChain", () => {
  it("derives now/then from required stops", () => {
    const chain = buildFuelStopChain({
      currentAlongRouteMiles: 0,
      destinationAlongRouteMiles: 1200,
      fuelPercent: 20,
      fuelRange: baseFuelRange,
      config,
      candidates: [
        candidate("a", 250, 3.4),
        candidate("b", 700, 3.1),
        candidate("c", 1050, 3.2),
      ],
    });

    const plan = buildFuelPlanFromChain({ fuelPercent: 20, config, chain });
    assert.ok((plan.stops?.length ?? 0) >= 2);
    assert.equal(plan.now?.relayLocationId, plan.stops?.[0]?.relayLocationId);
    assert.equal(plan.then?.relayLocationId, plan.stops?.[1]?.relayLocationId);
    assert.equal(plan.isLowFuel, true);
  });

  it("surfaces opportunistic cheapest when no required stops", () => {
    const chain = buildFuelStopChain({
      currentAlongRouteMiles: 0,
      destinationAlongRouteMiles: 100,
      fuelPercent: 20,
      fuelRange: baseFuelRange,
      config,
      candidates: [candidate("cheap", 60, 3.1)],
    });

    const plan = buildFuelPlanFromChain({ fuelPercent: 20, config, chain });
    assert.deepEqual(plan.stops, []);
    assert.equal(plan.canReachCheapestDirectly, true);
    assert.equal(plan.now?.relayLocationId, "cheap");
  });
});
