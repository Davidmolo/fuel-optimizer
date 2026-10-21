import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HttpError } from "../../utils/http-error";
import { deriveDriverAcceptLabel } from "../fleet/services/dispatcher-fleet-scope";
import {
  assertCreateAllowed,
  assertLabTablet,
  assertSendWhileBusyAllowed,
  assertUpdateAllowed,
  buildActionVerdict,
  buildCancelVerdict,
  buildInspectSummary,
  countGeocodedLoadStops,
  decideTablet999AutoSend,
  isLabTmsTripId,
  partitionLabTrips,
  pickTabletTrip,
  toLabTripView,
  type LabTripView,
  type WatchedLoadForAutoSend,
} from "./copilot-lab.rules";

function trip(overrides: Partial<LabTripView> & { alkTripId: string; tripStatus: string }): LabTripView {
  const tmsTripId = overrides.tmsTripId === undefined ? "fo-lab-1" : overrides.tmsTripId;
  return {
    alkTripId: overrides.alkTripId,
    tmsTripId,
    tripStatus: overrides.tripStatus,
    tspDriverId: overrides.tspDriverId ?? "999",
    isLabTrip: overrides.isLabTrip ?? isLabTmsTripId(tmsTripId),
    isActive:
      overrides.isActive ??
      (overrides.tripStatus === "InProgress" ||
        overrides.tripStatus === "Dispatched" ||
        overrides.tripStatus === "ReceivedByClient"),
    productionLabel: overrides.productionLabel ?? deriveDriverAcceptLabel(overrides.tripStatus),
    stops: overrides.stops ?? [],
    fuelStopCount: overrides.fuelStopCount ?? 0,
    hasFuelStop: overrides.hasFuelStop ?? false,
  };
}

describe("copilot lab guards", () => {
  it("recognizes only fo-lab trip ids", () => {
    assert.equal(isLabTmsTripId("fo-lab-171000"), true);
    assert.equal(isLabTmsTripId("fo-18421"), false);
    assert.equal(isLabTmsTripId(null), false);
  });

  it("refuses any tablet other than 999", () => {
    assert.doesNotThrow(() => assertLabTablet("999"));
    assert.throws(
      () => assertLabTablet("1013"),
      (error: unknown) => error instanceof HttpError && error.statusCode === 409,
    );
  });

  it("creates only when the tablet is idle and updates only a lab trip", () => {
    assert.doesNotThrow(() => assertCreateAllowed(null));
    assert.throws(
      () => assertCreateAllowed(trip({ alkTripId: "a", tripStatus: "InProgress" })),
      (error: unknown) => error instanceof HttpError && error.statusCode === 409,
    );

    const updated = assertUpdateAllowed(trip({ alkTripId: "a", tripStatus: "InProgress" }));
    assert.equal(updated.alkTripId, "a");
    assert.throws(
      () => assertUpdateAllowed(null),
      (error: unknown) => error instanceof HttpError && error.statusCode === 409,
    );
    assert.throws(
      () =>
        assertUpdateAllowed(
          trip({ alkTripId: "road", tripStatus: "InProgress", tmsTripId: "openroad-1", isLabTrip: false }),
        ),
      (error: unknown) => error instanceof HttpError && error.statusCode === 409,
    );
  });

  it("sends a second route only while a trip is already active", () => {
    assert.throws(
      () => assertSendWhileBusyAllowed(null),
      (error: unknown) => error instanceof HttpError && error.statusCode === 409,
    );
    const active = assertSendWhileBusyAllowed(
      trip({ alkTripId: "road", tripStatus: "InProgress", tmsTripId: "openroad-1", isLabTrip: false }),
    );
    assert.equal(active.isLabTrip, false);
  });

  it("cancels lab trips and leaves every other trip alone", () => {
    const parts = partitionLabTrips([
      trip({ alkTripId: "lab", tripStatus: "InProgress" }),
      trip({ alkTripId: "done", tripStatus: "Completed", tmsTripId: "fo-lab-old" }),
      trip({ alkTripId: "road", tripStatus: "InProgress", tmsTripId: "openroad-9", isLabTrip: false }),
    ]);

    assert.deepEqual(
      parts.deletable.map((item) => item.alkTripId),
      ["lab"],
    );
    assert.deepEqual(
      parts.finishedLab.map((item) => item.alkTripId),
      ["done"],
    );
    assert.deepEqual(
      parts.protectedTrips.map((item) => item.alkTripId),
      ["road"],
    );
  });
});

describe("copilot lab verdicts", () => {
  it("prefers the in-progress trip as the one the tablet is running", () => {
    const running = pickTabletTrip([
      trip({ alkTripId: "queued", tripStatus: "Dispatched", tmsTripId: "fo-lab-2" }),
      trip({ alkTripId: "live", tripStatus: "InProgress" }),
      trip({ alkTripId: "planned", tripStatus: "Planned", isActive: false }),
    ]);
    assert.equal(running?.alkTripId, "live");
  });

  it("does not treat a Planned second trip as accepted", () => {
    const active = trip({
      alkTripId: "live",
      tripStatus: "InProgress",
      tmsTripId: "openroad-1",
      isLabTrip: false,
    });
    const created = trip({ alkTripId: "new", tripStatus: "Planned", isActive: false, fuelStopCount: 1 });
    const verdict = buildActionVerdict({
      action: "send-while-busy",
      activeBefore: active,
      actedTrip: created,
      activeAfter: active,
    });

    assert.equal(verdict.reachedTablet, false);
    assert.equal(verdict.productionLabel, "accepted");
    assert.match(verdict.verdict, /was not accepted/);
    assert.match(verdict.verdict, /must not be read as Accepted/);
  });

  it("reports a received create and a Planned create differently", () => {
    const received = buildActionVerdict({
      action: "create",
      activeBefore: null,
      actedTrip: trip({ alkTripId: "new", tripStatus: "Dispatched", fuelStopCount: 0 }),
      activeAfter: trip({ alkTripId: "new", tripStatus: "Dispatched" }),
    });
    assert.equal(received.reachedTablet, true);
    assert.equal(received.productionLabel, "waiting");
    assert.match(received.verdict, /received this trip/);

    const planned = buildActionVerdict({
      action: "create",
      activeBefore: null,
      actedTrip: trip({ alkTripId: "new", tripStatus: "Planned", isActive: false }),
      activeAfter: null,
    });
    assert.equal(planned.reachedTablet, false);
    assert.equal(planned.productionLabel, "not_sent");
    assert.match(planned.verdict, /stayed Planned/);
  });

  it("describes an in-place update without calling it a new accept", () => {
    const current = trip({ alkTripId: "live", tripStatus: "InProgress", fuelStopCount: 2, hasFuelStop: true });
    const verdict = buildActionVerdict({
      action: "update-active",
      activeBefore: current,
      actedTrip: current,
      activeAfter: current,
    });
    assert.equal(verdict.reachedTablet, true);
    assert.match(verdict.verdict, /in place/);
    assert.match(verdict.verdict, /Fuel stops on the trip: 2/);
  });

  it("says when the tablet is busy and which label production would show", () => {
    const summary = buildInspectSummary(
      [
        trip({ alkTripId: "live", tripStatus: "InProgress", tmsTripId: "openroad-1", isLabTrip: false }),
        trip({ alkTripId: "queued", tripStatus: "Planned", isActive: false }),
      ],
      trip({ alkTripId: "live", tripStatus: "InProgress", tmsTripId: "openroad-1", isLabTrip: false }),
    );
    assert.match(summary, /InProgress/);
    assert.match(summary, /Accepted/);
    assert.match(summary, /not the one on the tablet/);
  });

  it("maps a Trimble trip into a lab view", () => {
    const view = toLabTripView({
      alkTripId: 42,
      tmsTripId: "fo-lab-42",
      tripStatus: 0,
      tspDriverId: "999",
      stops: [
        { stopType: "Origin", location: { label: "Denver", coords: { lat: "39.7", lon: "-104.9" } } },
        { stopType: "FuelStop", location: { label: "Pilot", coords: { lat: "39.1", lon: "-104.8" } } },
      ],
    });
    assert.equal(view?.tripStatus, "Planned");
    assert.equal(view?.isLabTrip, true);
    assert.equal(view?.isActive, false);
    assert.equal(view?.hasFuelStop, true);
    assert.equal(view?.productionLabel, "not_sent");
  });

  it("reports a clear that skipped non-lab trips", () => {
    const verdict = buildCancelVerdict({
      deletedCount: 1,
      finishedLabCount: 0,
      protectedCount: 1,
      activeAfter: trip({ alkTripId: "road", tripStatus: "InProgress", tmsTripId: "openroad-1", isLabTrip: false }),
    });
    assert.equal(verdict.reachedTablet, false);
    assert.match(verdict.verdict, /Deleted 1 lab trip/);
    assert.match(verdict.verdict, /left unchanged/);
    assert.equal(verdict.productionLabel, "accepted");
  });

  it("sends the named load to tablet 999 only when that tablet is clear", () => {
    const ready: WatchedLoadForAutoSend = {
      found: true,
      openroadLoadId: 42,
      geocodedStopCount: 2,
      tspDriverId: null,
      ownedByOtherSystem: false,
    };

    assert.equal(decideTablet999AutoSend({ load: { ...ready, found: false }, tabletBusy: false }), "waiting");
    assert.equal(decideTablet999AutoSend({ load: ready, tabletBusy: false }), "send");
    assert.equal(decideTablet999AutoSend({ load: ready, tabletBusy: true }), "busy");
    assert.equal(
      decideTablet999AutoSend({ load: { ...ready, geocodedStopCount: 1 }, tabletBusy: false }),
      "not-ready",
    );
    assert.equal(
      decideTablet999AutoSend({ load: { ...ready, tspDriverId: "999" }, tabletBusy: false }),
      "already-on-lab",
    );
    assert.equal(
      decideTablet999AutoSend({ load: { ...ready, tspDriverId: "1013" }, tabletBusy: false }),
      "blocked-fleet",
    );
    assert.equal(
      decideTablet999AutoSend({ load: { ...ready, ownedByOtherSystem: true }, tabletBusy: false }),
      "blocked-other-system",
    );
    assert.equal(countGeocodedLoadStops([{ lat: 1, lng: 2 }, { lat: null, lng: 3 }, { lat: 4, lng: 5 }]), 2);
  });
});
