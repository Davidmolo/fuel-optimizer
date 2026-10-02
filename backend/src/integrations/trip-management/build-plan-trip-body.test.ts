import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFuelOptimizerTmsTripId,
  buildPlanTripBody,
  buildRoutingProfile,
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
    assert.deepEqual(body.routingProfile, { name: "XXII Century", routingType: 0 });
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

  it("includes optional Trimble identity fields when provided", () => {
    const body = buildPlanTripBody({
      tmsTripId: "fo-999",
      stops: [
        { stopType: "Origin", lat: 32.9126, lon: -96.6389 },
        { stopType: "Destination", lat: 29.7604, lon: -95.3698 },
      ],
      assignTablet: true,
      tspDriverId: "999",
      tspId: "copilot-provider",
      tmsCustomerId: "BXTQPL",
      tmsId: 0,
      tmsUserId: "fuel-optimizer",
    });

    assert.equal(body.tspDriverId, "999");
    assert.equal(body.tspId, "copilot-provider");
    assert.equal(body.tmsCustomerId, "BXTQPL");
    assert.equal(body.tmsId, 0);
    assert.equal(body.tmsUserId, "fuel-optimizer");
  });

  it("sends company routing profile name so CoPilot can skip Use Profile", () => {
    const body = buildPlanTripBody({
      stops: [
        { stopType: "Origin", lat: 32.9126, lon: -96.6389 },
        { stopType: "Destination", lat: 40.3978, lon: -105.075 },
      ],
      routingProfileName: "XXII Century",
    });

    assert.deepEqual(body.routingProfile, { name: "XXII Century", routingType: 0 });
  });
});

describe("buildRoutingProfile", () => {
  it("defaults to XXII Century Practical", () => {
    assert.deepEqual(buildRoutingProfile(), { name: "XXII Century", routingType: 0 });
  });

  it("allows override name and routing type", () => {
    assert.deepEqual(buildRoutingProfile({ routingProfileName: "Custom", routingType: 2 }), {
      name: "Custom",
      routingType: 2,
    });
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
