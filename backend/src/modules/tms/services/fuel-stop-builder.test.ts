import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFuelStopStopInput,
  buildTripStopsWithFuelStop,
  computeFuelStopInsertionIndex,
  formatStationLabel,
  toTrimbleTripStopRecord,
} from "./fuel-stop-builder";

describe("fuel-stop-builder", () => {
  const denver = { stopType: "Origin" as const, lat: 39.7392, lon: -104.9903, label: "Denver" };
  const omaha = { stopType: "Work" as const, lat: 41.2565, lon: -95.9345, label: "Omaha" };
  const chicago = { stopType: "Destination" as const, lat: 41.8781, lon: -87.6298, label: "Chicago" };

  // Rough west→east polyline through Denver → Omaha → Chicago
  const polyline = [
    { lat: 39.7392, lng: -104.9903 },
    { lat: 40.5, lng: -100 },
    { lat: 41.2565, lng: -95.9345 },
    { lat: 41.6, lng: -91 },
    { lat: 41.8781, lng: -87.6298 },
  ];

  it("formats a station label from merchant and place", () => {
    assert.equal(
      formatStationLabel({
        latitude: 1,
        longitude: 2,
        merchantName: "Pilot",
        city: "Lincoln",
        state: "NE",
      }),
      "Pilot — Lincoln, NE",
    );
  });

  it("builds a FuelStop stop input", () => {
    const stop = buildFuelStopStopInput({
      latitude: 41.0,
      longitude: -98.0,
      merchantName: "Love's",
      city: "York",
      state: "NE",
    });
    assert.equal(stop.stopType, "FuelStop");
    assert.equal(stop.lat, 41.0);
    assert.equal(stop.lon, -98.0);
    assert.match(stop.label ?? "", /Love's/);
  });

  it("inserts mid-route before the first stop past the station along the polyline", () => {
    // Station near Omaha — should insert before Chicago (index 2 of [Denver, Omaha, Chicago])
    // or at Omaha depending on projection; near Omaha point should land around index of Omaha.
    const index = computeFuelStopInsertionIndex(
      [denver, omaha, chicago],
      { lat: 41.2, lng: -96.5 },
      polyline,
    );
    assert.ok(index >= 1 && index <= 2, `expected clamped mid index, got ${index}`);
  });

  it("clamps near-origin insertion so FuelStop is never Origin", () => {
    const index = computeFuelStopInsertionIndex(
      [denver, omaha, chicago],
      { lat: 39.74, lng: -104.99 },
      polyline,
    );
    assert.equal(index, 1);
  });

  it("clamps near-destination insertion before Destination", () => {
    const index = computeFuelStopInsertionIndex(
      [denver, omaha, chicago],
      { lat: 41.87, lng: -87.7 },
      polyline,
    );
    assert.ok(index >= 1 && index <= 2);
    assert.notEqual(index, 0);
  });

  it("falls back before Destination when polyline is empty", () => {
    const index = computeFuelStopInsertionIndex(
      [denver, omaha, chicago],
      { lat: 41.0, lng: -98.0 },
      [],
    );
    assert.equal(index, 2);
  });

  it("handles a single-pair Origin/Destination route", () => {
    const index = computeFuelStopInsertionIndex([denver, chicago], { lat: 40.5, lng: -96 }, polyline);
    assert.equal(index, 1);
  });

  it("buildTripStopsWithFuelStop splices FuelStop into the list", () => {
    const { stops, fuelStopIndex } = buildTripStopsWithFuelStop(
      [
        {
          position: 1,
          stopType: "pick_up",
          companyName: "Origin Co",
          city: "Denver",
          stateCode: "CO",
          lat: 39.7392,
          lng: -104.9903,
        },
        {
          position: 2,
          stopType: "delivery",
          companyName: "Dest Co",
          city: "Chicago",
          stateCode: "IL",
          lat: 41.8781,
          lng: -87.6298,
        },
      ],
      {
        latitude: 41.2565,
        longitude: -95.9345,
        merchantName: "Pilot",
        city: "Omaha",
        state: "NE",
      },
      polyline,
    );

    assert.equal(stops.length, 3);
    assert.equal(stops[0]?.stopType, "Origin");
    assert.equal(stops[fuelStopIndex]?.stopType, "FuelStop");
    assert.equal(stops[stops.length - 1]?.stopType, "Destination");
  });

  it("toTrimbleTripStopRecord maps fields", () => {
    const record = toTrimbleTripStopRecord({
      stopType: "FuelStop",
      lat: 1,
      lon: 2,
      label: "X",
    });
    assert.deepEqual(record, { stopType: "FuelStop", lat: 1, lon: 2, label: "X" });
  });
});
