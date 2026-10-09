import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TrimbleTripFuelStopRecord } from "../models/tms-load.model";
import {
  carryStickyFuelStopEvidence,
  mergeFuelStopStatusFromTripResponse,
  withStickyGpsNearAt,
} from "./fuel-stop-status";

function planned(partial: Partial<TrimbleTripFuelStopRecord> = {}): TrimbleTripFuelStopRecord {
  return {
    relayAccount: "blue_stallion",
    relayLocationId: "loc-1",
    latitude: 35.1,
    longitude: -90.1,
    stopIndex: 1,
    insertedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...partial,
  };
}

describe("mergeFuelStopStatusFromTripResponse", () => {
  it("marks arrived sticky when Trimble reports FuelStop arrived", () => {
    const observedAt = new Date("2026-01-02T00:00:00.000Z");
    const merged = mergeFuelStopStatusFromTripResponse(
      [planned()],
      [
        {
          stopType: "FuelStop",
          arrived: true,
          location: { coords: { lat: 35.1, lon: -90.1 } },
        },
      ],
      observedAt,
    );

    assert.equal(merged[0]?.arrived, true);
    assert.equal(merged[0]?.statusObservedAt?.toISOString(), observedAt.toISOString());
  });

  it("does not clear arrived on a later refresh that omits arrival", () => {
    const first = mergeFuelStopStatusFromTripResponse(
      [planned()],
      [{ stopType: "FuelStop", arrived: true, location: { coords: { lat: 35.1, lon: -90.1 } } }],
      new Date("2026-01-02T00:00:00.000Z"),
    );
    const second = mergeFuelStopStatusFromTripResponse(
      first,
      [{ stopType: "FuelStop", arrived: false, location: { coords: { lat: 35.1, lon: -90.1 } } }],
      new Date("2026-01-03T00:00:00.000Z"),
    );

    assert.equal(second[0]?.arrived, true);
  });
});

describe("carryStickyFuelStopEvidence", () => {
  it("carries arrived and gpsNearAt onto a replacement chain by location", () => {
    const previous = [
      planned({
        arrived: true,
        gpsNearAt: new Date("2026-01-02T00:00:00.000Z"),
        statusObservedAt: new Date("2026-01-02T00:00:00.000Z"),
      }),
    ];
    const next = [planned({ insertedAt: new Date("2026-01-04T00:00:00.000Z") })];
    const carried = carryStickyFuelStopEvidence(previous, next);

    assert.equal(carried[0]?.arrived, true);
    assert.ok(carried[0]?.gpsNearAt);
  });
});

describe("withStickyGpsNearAt", () => {
  it("sets gpsNearAt once and keeps the first timestamp", () => {
    const first = withStickyGpsNearAt(planned(), new Date("2026-01-02T00:00:00.000Z"));
    const second = withStickyGpsNearAt(first, new Date("2026-01-03T00:00:00.000Z"));

    assert.equal(second.gpsNearAt?.toISOString(), "2026-01-02T00:00:00.000Z");
  });
});
