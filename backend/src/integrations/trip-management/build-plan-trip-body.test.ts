import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFuelOptimizerTmsTripId,
  buildPlanTripBody,
  isFuelOptimizerTmsTripId,
} from "./build-plan-trip-body";

describe("buildPlanTripBody", () => {
  it("omits tspDriverId so Phase 1 never assigns a tablet", () => {
    const body = buildPlanTripBody({
      tmsTripId: "fo-12345",
      name: "Fuel Optimizer load 12345",
      stops: [
        { stopType: "Origin", lat: 39.7392, lon: -104.9903, label: "Denver" },
        { stopType: "Destination", lat: 41.8781, lon: -87.6298, label: "Chicago" },
      ],
    });

    assert.equal(body.storeTrip, true);
    assert.equal(body.tmsTripId, "fo-12345");
    assert.equal((body.routingProfile as { routingType: number }).routingType, 0);
    assert.equal("tspDriverId" in body, false);
    assert.deepEqual(body.stops, [
      {
        stopType: "Origin",
        location: {
          coords: { lat: "39.739200", lon: "-104.990300" },
          label: "Denver",
        },
      },
      {
        stopType: "Destination",
        location: {
          coords: { lat: "41.878100", lon: "-87.629800" },
          label: "Chicago",
        },
      },
    ]);
  });

  it("requires at least two stops", () => {
    assert.throws(
      () =>
        buildPlanTripBody({
          stops: [{ stopType: "Origin", lat: 39.7, lon: -104.9 }],
        }),
      /At least two geocoded stops/,
    );
  });
});

describe("fuel optimizer tms trip ids", () => {
  it("builds and recognizes owned trip ids", () => {
    assert.equal(buildFuelOptimizerTmsTripId(239), "fo-239");
    assert.equal(isFuelOptimizerTmsTripId("fo-239"), true);
    assert.equal(isFuelOptimizerTmsTripId("fo-239-1710000000"), true);
    assert.equal(isFuelOptimizerTmsTripId("openroad-239"), false);
    assert.equal(isFuelOptimizerTmsTripId(""), false);
  });
});
