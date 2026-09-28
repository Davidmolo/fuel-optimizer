import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapLoadDestinationsToTripStops } from "./map-load-to-trip-stops";

describe("mapLoadDestinationsToTripStops", () => {
  it("maps first/last geocoded stops to Origin/Destination and middle to Work", () => {
    const stops = mapLoadDestinationsToTripStops([
      {
        position: 2,
        stopType: "delivery",
        companyName: "Mid Stop",
        city: "Omaha",
        stateCode: "NE",
        lat: 41.2565,
        lng: -95.9345,
      },
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
        position: 3,
        stopType: "delivery",
        companyName: "Dest Co",
        city: "Chicago",
        stateCode: "IL",
        lat: 41.8781,
        lng: -87.6298,
      },
    ]);

    assert.equal(stops.length, 3);
    assert.equal(stops[0]?.stopType, "Origin");
    assert.equal(stops[0]?.lat, 39.7392);
    assert.equal(stops[0]?.lon, -104.9903);
    assert.equal(stops[1]?.stopType, "Work");
    assert.equal(stops[2]?.stopType, "Destination");
    assert.match(stops[0]?.label ?? "", /Origin Co/);
  });

  it("drops stops without coordinates and returns empty when fewer than two remain", () => {
    const stops = mapLoadDestinationsToTripStops([
      {
        position: 1,
        stopType: "pick_up",
        city: "Denver",
        stateCode: "CO",
        lat: 39.7392,
        lng: -104.9903,
      },
      {
        position: 2,
        stopType: "delivery",
        city: "Unknown",
        stateCode: "XX",
      },
    ]);

    assert.deepEqual(stops, []);
  });
});
