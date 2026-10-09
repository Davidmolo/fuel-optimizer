import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateDriverCompliance,
  matchPlannedStopsToTransactions,
  type FuelTransactionInput,
  type PlannedFuelStopInput,
} from "./driver-compliance.matching";

function stop(partial: Partial<PlannedFuelStopInput> & Pick<PlannedFuelStopInput, "key">): PlannedFuelStopInput {
  return {
    driverId: 1,
    relayAccount: "blue_stallion",
    relayLocationId: "loc-1",
    insertedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...partial,
  };
}

function tx(
  partial: Partial<FuelTransactionInput> & Pick<FuelTransactionInput, "key">,
): FuelTransactionInput {
  return {
    relayAccount: "blue_stallion",
    locationId: "loc-1",
    occurredAt: new Date("2026-01-02T00:00:00.000Z"),
    ...partial,
  };
}

describe("matchPlannedStopsToTransactions", () => {
  it("marks followed when a matching Relay purchase falls inside the window", () => {
    const results = matchPlannedStopsToTransactions([stop({ key: "s1" })], [tx({ key: "t1" })]);

    assert.equal(results[0]?.followed, true);
    assert.equal(results[0]?.relayPurchased, true);
    assert.equal(results[0]?.trimbleArrived, false);
    assert.equal(results[0]?.matchedTransactionKey, "t1");
  });

  it("marks followed when Trimble arrived even without a purchase", () => {
    const results = matchPlannedStopsToTransactions(
      [stop({ key: "s1", trimbleArrived: true })],
      [],
    );

    assert.equal(results[0]?.followed, true);
    assert.equal(results[0]?.trimbleArrived, true);
    assert.equal(results[0]?.relayPurchased, false);
  });

  it("does not count GPS near alone as followed", () => {
    const results = matchPlannedStopsToTransactions([stop({ key: "s1", gpsNear: true })], []);

    assert.equal(results[0]?.followed, false);
    assert.equal(results[0]?.gpsNear, true);
  });

  it("does not match wrong location or account", () => {
    const results = matchPlannedStopsToTransactions(
      [stop({ key: "s1" })],
      [
        tx({ key: "wrong-loc", locationId: "other" }),
        tx({ key: "wrong-acct", relayAccount: "azfs" }),
      ],
    );

    assert.equal(results[0]?.followed, false);
  });

  it("does not match transactions before the stop was planned or after the window", () => {
    const results = matchPlannedStopsToTransactions(
      [stop({ key: "s1", insertedAt: new Date("2026-01-10T00:00:00.000Z") })],
      [
        tx({ key: "too-early", occurredAt: new Date("2026-01-09T00:00:00.000Z") }),
        tx({ key: "too-late", occurredAt: new Date("2026-01-18T00:00:00.000Z") }),
      ],
    );

    assert.equal(results[0]?.followed, false);
  });

  it("respects a tighter trip completion match window", () => {
    const results = matchPlannedStopsToTransactions(
      [
        stop({
          key: "s1",
          insertedAt: new Date("2026-01-01T00:00:00.000Z"),
          matchWindowEndAt: new Date("2026-01-03T00:00:00.000Z"),
        }),
      ],
      [tx({ key: "t-late", occurredAt: new Date("2026-01-05T00:00:00.000Z") })],
    );

    assert.equal(results[0]?.followed, false);
  });

  it("includes exact window boundaries (insertedAt and insertedAt+7d)", () => {
    const insertedAt = new Date("2026-01-10T12:00:00.000Z");
    const windowEnd = new Date("2026-01-17T12:00:00.000Z");

    const atStart = matchPlannedStopsToTransactions(
      [stop({ key: "s1", insertedAt })],
      [tx({ key: "t-start", occurredAt: insertedAt })],
    );
    const atEnd = matchPlannedStopsToTransactions(
      [stop({ key: "s2", insertedAt })],
      [tx({ key: "t-end", occurredAt: windowEnd })],
    );

    assert.equal(atStart[0]?.followed, true);
    assert.equal(atEnd[0]?.followed, true);
  });

  it("uses each transaction for at most one stop", () => {
    const results = matchPlannedStopsToTransactions(
      [
        stop({ key: "s1", insertedAt: new Date("2026-01-01T00:00:00.000Z") }),
        stop({ key: "s2", insertedAt: new Date("2026-01-02T00:00:00.000Z") }),
      ],
      [tx({ key: "t1", occurredAt: new Date("2026-01-03T00:00:00.000Z") })],
    );

    assert.equal(results.find((row) => row.key === "s1")?.followed, true);
    assert.equal(results.find((row) => row.key === "s2")?.followed, false);
  });

  it("counts arrived+purchased as a single followed stop", () => {
    const results = matchPlannedStopsToTransactions(
      [stop({ key: "s1", trimbleArrived: true })],
      [tx({ key: "t1" })],
    );

    assert.equal(results[0]?.followed, true);
    assert.equal(results[0]?.trimbleArrived, true);
    assert.equal(results[0]?.relayPurchased, true);
  });

  it("pairs different stations correctly in a realistic multi-stop trip", () => {
    const results = matchPlannedStopsToTransactions(
      [
        stop({
          key: "loves",
          relayLocationId: "loves-100",
          insertedAt: new Date("2026-03-01T08:00:00.000Z"),
        }),
        stop({
          key: "pilot",
          relayLocationId: "pilot-200",
          insertedAt: new Date("2026-03-01T09:00:00.000Z"),
        }),
      ],
      [
        tx({
          key: "tx-pilot",
          locationId: "pilot-200",
          occurredAt: new Date("2026-03-01T18:00:00.000Z"),
        }),
        tx({
          key: "tx-loves",
          locationId: "loves-100",
          occurredAt: new Date("2026-03-01T14:00:00.000Z"),
        }),
      ],
    );

    assert.equal(results.find((row) => row.key === "loves")?.matchedTransactionKey, "tx-loves");
    assert.equal(results.find((row) => row.key === "pilot")?.matchedTransactionKey, "tx-pilot");
  });

  it("counts as missed when driver fueled at a different station and never arrived", () => {
    const results = matchPlannedStopsToTransactions(
      [stop({ key: "planned-loves", relayLocationId: "loves-100" })],
      [tx({ key: "tx-pilot", locationId: "pilot-999", occurredAt: new Date("2026-01-02T00:00:00.000Z") })],
    );

    assert.equal(results[0]?.followed, false);
  });
});

describe("aggregateDriverCompliance", () => {
  it("aggregates evidence counts and sorts worst compliance first", () => {
    const rows = aggregateDriverCompliance([
      {
        ...stop({ key: "a1", driverId: 10 }),
        followed: true,
        trimbleArrived: true,
        relayPurchased: false,
        gpsNear: true,
      },
      {
        ...stop({ key: "a2", driverId: 10 }),
        followed: false,
        trimbleArrived: false,
        relayPurchased: false,
        gpsNear: false,
      },
      {
        ...stop({ key: "b1", driverId: 20 }),
        followed: true,
        trimbleArrived: false,
        relayPurchased: true,
        gpsNear: false,
      },
      {
        ...stop({ key: "b2", driverId: 20 }),
        followed: true,
        trimbleArrived: true,
        relayPurchased: true,
        gpsNear: true,
      },
    ]);

    assert.deepEqual(rows[0], {
      driverId: 10,
      assignedStops: 2,
      followedStops: 1,
      missedStops: 1,
      arrivedStops: 1,
      purchasedStops: 0,
      gpsNearStops: 1,
      compliancePercent: 50,
    });
    assert.equal(rows[1]?.driverId, 20);
    assert.equal(rows[1]?.compliancePercent, 100);
    assert.equal(rows[1]?.arrivedStops, 1);
    assert.equal(rows[1]?.purchasedStops, 2);
  });

  it("rounds compliance percent to one decimal (1 of 3 = 33.3%)", () => {
    const rows = aggregateDriverCompliance([
      {
        ...stop({ key: "1", driverId: 7 }),
        followed: true,
        trimbleArrived: true,
        relayPurchased: false,
        gpsNear: false,
      },
      {
        ...stop({ key: "2", driverId: 7 }),
        followed: false,
        trimbleArrived: false,
        relayPurchased: false,
        gpsNear: false,
      },
      {
        ...stop({ key: "3", driverId: 7 }),
        followed: false,
        trimbleArrived: false,
        relayPurchased: false,
        gpsNear: false,
      },
    ]);

    assert.equal(rows[0]?.compliancePercent, 33.3);
  });
});

describe("practical dual-signal scenario", () => {
  it("credits arrival without purchase and purchase without arrival", () => {
    const matches = matchPlannedStopsToTransactions(
      [
        stop({ key: "ali-arrive", driverId: 101, relayLocationId: "a", trimbleArrived: true }),
        stop({ key: "ali-miss", driverId: 101, relayLocationId: "b" }),
        stop({ key: "ali-buy", driverId: 101, relayLocationId: "c" }),
        stop({ key: "sara-1", driverId: 202, relayLocationId: "d", gpsNear: true }),
        stop({ key: "sara-2", driverId: 202, relayLocationId: "e", trimbleArrived: true }),
      ],
      [
        tx({ key: "t-c", locationId: "c", occurredAt: new Date("2026-01-02T00:00:00.000Z") }),
        tx({ key: "t-d", locationId: "d", occurredAt: new Date("2026-01-02T00:00:00.000Z") }),
      ],
    );

    const rows = aggregateDriverCompliance(matches);
    const ali = rows.find((row) => row.driverId === 101);
    const sara = rows.find((row) => row.driverId === 202);

    assert.deepEqual(ali, {
      driverId: 101,
      assignedStops: 3,
      followedStops: 2,
      missedStops: 1,
      arrivedStops: 1,
      purchasedStops: 1,
      gpsNearStops: 0,
      compliancePercent: 66.7,
    });
    assert.deepEqual(sara, {
      driverId: 202,
      assignedStops: 2,
      followedStops: 2,
      missedStops: 0,
      arrivedStops: 1,
      purchasedStops: 1,
      gpsNearStops: 1,
      compliancePercent: 100,
    });
  });
});
