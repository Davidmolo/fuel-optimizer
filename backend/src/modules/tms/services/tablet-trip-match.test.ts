import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  confirmOwnedTripForFuelUpdate,
  pickActiveTabletTrip,
  resolveCopilotSendPlan,
  resolveInProgressFuelUpdateTarget,
  tripMatchesLoad,
  type TabletTripCandidate,
} from "./tablet-trip-match";

const godfrey = { lat: 38.955, lng: -90.186 };
const pioneer = { lat: 41.657, lng: -84.552 };
const loadStops = [
  { lat: godfrey.lat, lng: godfrey.lng },
  { lat: pioneer.lat, lng: pioneer.lng },
];

function candidate(overrides: Partial<TabletTripCandidate> & Pick<TabletTripCandidate, "alkTripId" | "tripStatus">): TabletTripCandidate {
  return {
    tmsTripId: null,
    tspDriverId: "1013",
    stops: [
      { lat: godfrey.lat, lon: godfrey.lng, stopType: "Work", label: "IMC Outdoor Living" },
      { lat: pioneer.lat, lon: pioneer.lng, stopType: "Work", label: "Menards" },
    ],
    ...overrides,
  };
}

describe("tablet trip matching", () => {
  it("matches an Open Road trip by pickup and delivery location, not stop type", () => {
    const trip = candidate({ alkTripId: "331397433", tripStatus: "InProgress", tmsTripId: "9910c581_1" });
    assert.equal(tripMatchesLoad(loadStops, trip.stops), true);
    assert.equal(pickActiveTabletTrip([trip], loadStops)?.alkTripId, "331397433");
  });

  it("ignores a planned copy when the tablet is already in this load", () => {
    const planned = candidate({
      alkTripId: "331401996",
      tripStatus: "Planned",
      tmsTripId: "fo-2353614-1792100873818",
    });
    const live = candidate({ alkTripId: "331397433", tripStatus: "InProgress", tmsTripId: "9910c581_1" });

    assert.equal(pickActiveTabletTrip([planned, live], loadStops)?.alkTripId, "331397433");
  });

  it("prefers the in-progress trip over a dispatched one", () => {
    const dispatched = candidate({ alkTripId: "1", tripStatus: "Dispatched" });
    const inProgress = candidate({ alkTripId: "2", tripStatus: "InProgress" });
    assert.equal(pickActiveTabletTrip([dispatched, inProgress], loadStops)?.alkTripId, "2");
  });

  it("does not match a trip for a different load", () => {
    const other = candidate({
      alkTripId: "9",
      tripStatus: "InProgress",
      stops: [
        { lat: 32.78, lon: -96.8, stopType: "Work" },
        { lat: 39.74, lon: -104.99, stopType: "Work" },
      ],
    });
    assert.equal(tripMatchesLoad(loadStops, other.stops), false);
    assert.equal(pickActiveTabletTrip([other], loadStops), null);
  });

  it("matches a Fuel Optimizer trip once that trip is on the tablet", () => {
    const owned = candidate({
      alkTripId: "50",
      tripStatus: "ReceivedByClient",
      tmsTripId: "fo-2353614",
      stops: [
        { lat: godfrey.lat + 0.01, lon: godfrey.lng, stopType: "Origin" },
        { lat: pioneer.lat, lon: pioneer.lng + 0.01, stopType: "Destination" },
      ],
    });
    assert.equal(pickActiveTabletTrip([owned], loadStops)?.tmsTripId, "fo-2353614");
  });
});

describe("in-progress fuel update target", () => {
  it("updates the Open Road trip the tablet is already driving", () => {
    const target = resolveInProgressFuelUpdateTarget({
      activeTabletTrip: { alkTripId: "331397433" },
      ownedTrip: { alkTripId: "331401983", tmsTripId: "fo-2353614", tripStatus: "Planned" },
    });
    assert.deepEqual(target, { action: "update", alkTripId: "331397433" });
  });

  it("asks for a live check when search misses a stored in-progress or received trip", () => {
    assert.deepEqual(
      resolveInProgressFuelUpdateTarget({
        activeTabletTrip: null,
        ownedTrip: { alkTripId: "50", tmsTripId: "fo-2353614", tripStatus: "InProgress" },
      }),
      { action: "confirm-owned", alkTripId: "50" },
    );
    assert.deepEqual(
      resolveInProgressFuelUpdateTarget({
        activeTabletTrip: null,
        ownedTrip: { alkTripId: "51", tmsTripId: "9910c581_1", tripStatus: "ReceivedByClient" },
      }),
      { action: "confirm-owned", alkTripId: "51" },
    );
  });

  it("confirms a stored trip only while Trimble still shows it active on this load", () => {
    assert.deepEqual(
      confirmOwnedTripForFuelUpdate({
        tripStatus: "InProgress",
        stops: [
          { lat: godfrey.lat, lon: godfrey.lng },
          { lat: pioneer.lat, lon: pioneer.lng },
        ],
        destinations: loadStops,
      }),
      { action: "confirmed" },
    );
    assert.equal(
      confirmOwnedTripForFuelUpdate({
        tripStatus: "ReceivedByClient",
        stops: [
          { lat: godfrey.lat, lon: godfrey.lng },
          { lat: pioneer.lat, lon: pioneer.lng },
        ],
        destinations: loadStops,
      }).action,
      "confirmed",
    );
    assert.equal(
      confirmOwnedTripForFuelUpdate({
        tripStatus: "Completed",
        stops: [
          { lat: godfrey.lat, lon: godfrey.lng },
          { lat: pioneer.lat, lon: pioneer.lng },
        ],
        destinations: loadStops,
      }).action,
      "refuse",
    );
    assert.equal(
      confirmOwnedTripForFuelUpdate({
        tripStatus: "InProgress",
        stops: [
          { lat: 32.78, lon: -96.8 },
          { lat: 39.74, lon: -104.99 },
        ],
        destinations: loadStops,
      }).action,
      "refuse",
    );
  });

  it("does not edit a Planned copy or create a second trip", () => {
    const target = resolveInProgressFuelUpdateTarget({
      activeTabletTrip: null,
      ownedTrip: { alkTripId: "331401983", tmsTripId: "fo-2353614", tripStatus: "Planned" },
    });
    assert.equal(target.action, "refuse");
  });

  it("refuses when the driver has no active trip for this load", () => {
    const target = resolveInProgressFuelUpdateTarget({ activeTabletTrip: null, ownedTrip: null });
    assert.equal(target.action, "refuse");
  });
});

describe("send branch", () => {
  it("updates the matched tablet trip and creates a trip only when nothing is active", () => {
    const match = candidate({ alkTripId: "331397433", tripStatus: "InProgress" });
    assert.deepEqual(resolveCopilotSendPlan(match), {
      action: "update-existing",
      alkTripId: "331397433",
    });
    assert.deepEqual(resolveCopilotSendPlan(null), { action: "create-new" });
    assert.deepEqual(resolveCopilotSendPlan(pickActiveTabletTrip([], loadStops)), { action: "create-new" });
  });
});
